const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const prisma = require('../dist/config/prisma.js').default;
const app = require('../dist/app.js').default;
const { canonicalizeRepositoryUrl } = require('../dist/services/repository-url.service.js');
const { createPendingRepository, updateRepositoryLifecycle, claimPendingRepository, updateOwnedRepositoryLifecycle } = require('../dist/repositories/repository.repository.js');
const { queueRepositoryImport, enqueueRepositoryForAnalysis, retryRepositoryImport, recoverInterruptedRepositories, drainRepositoryWorkers } = require('../dist/services/repository-lifecycle.service.js');
const { runRepositoryAnalysis } = require('../dist/services/repository-analysis.service.js');
const { loadRepositoryExplorerState, getRepositoryRootPath } = require('../dist/services/repository-explorer-state.service.js');

const accessSecret = process.env.JWT_ACCESS_SECRET || 'integration-access-secret';

test.before(async () => {
  await prisma.$queryRaw`SELECT 1`;
  await prisma.repository.count();
});

test.after(async () => {
  await prisma.$disconnect();
});

function token(user) {
  return jwt.sign({ userId: user.id, email: user.email }, accessSecret);
}

async function request(server, route, options = {}) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, options);
  const body = await response.json();
  return { status: response.status, body };
}

async function startServer() {
  const server = require('node:http').createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  return server;
}

test('canonicalizes GitHub URLs and rejects unsupported sources', () => {
  assert.deepEqual(canonicalizeRepositoryUrl('https://www.github.com/Example/Project/'), {
    canonicalUrl: 'https://github.com/example/project.git',
    sourceKey: 'github:example/project',
    owner: 'example',
    name: 'project',
  });
  assert.deepEqual(canonicalizeRepositoryUrl('https://github.com/Example/Project.git'), canonicalizeRepositoryUrl('https://github.com/example/project'));
  for (const invalid of [
    'http://github.com/example/project',
    'https://gitlab.com/example/project',
    'git@github.com:example/project.git',
    'https://user:pass@github.com/example/project',
    'https://github.com/example/project?token=secret',
    'C:\\repositories\\project',
    'https://github.com/example',
  ]) {
    assert.throws(() => canonicalizeRepositoryUrl(invalid), /GitHub|invalid|unsupported/i);
  }
});

test('invalid public imports fail before a lifecycle row is created', async () => {
  const user = await prisma.user.create({ data: { name: 'URL Test', email: `url-${crypto.randomUUID()}@example.com`, password: 'test' } });
  const server = await startServer();
  try {
    const response = await request(server, '/api/v1/repositories/import', {
      method: 'POST',
      headers: { authorization: `Bearer ${token(user)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://gitlab.com/example/project' }),
    });
    assert.equal(response.status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('duplicate lifecycle requests converge on one owner-scoped row', async () => {
  const user = await prisma.user.create({ data: { name: 'Duplicate Test', email: `duplicate-${crypto.randomUUID()}@example.com`, password: 'test' } });
  const source = 'https://github.com/example/duplicate.git';
  try {
    const results = await Promise.all([
      queueRepositoryImport(source, user.id, { enqueue: false }),
      queueRepositoryImport('https://www.github.com/Example/Duplicate/', user.id, { enqueue: false }),
    ]);
    assert.equal(new Set(results.map(result => result.repository.id)).size, 1);
    assert.equal(results.filter(result => result.created).length, 1);
    assert.equal(await prisma.repository.count({ where: { ownerId: user.id } }), 1);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('incomplete repositories are status-visible but cannot serve intelligence', async () => {
  const owner = await prisma.user.create({ data: { name: 'Pending Owner', email: `pending-${crypto.randomUUID()}@example.com`, password: 'test' } });
  const other = await prisma.user.create({ data: { name: 'Pending Other', email: `pending-other-${crypto.randomUUID()}@example.com`, password: 'test' } });
  const repositoryId = `pending-${crypto.randomUUID()}`;
  await createPendingRepository({ id: repositoryId, ownerId: owner.id, sourceUrl: 'https://github.com/example/pending.git', sourceKey: `github:example/pending-${repositoryId}` });
  const server = await startServer();
  try {
    const ownerHeaders = { authorization: `Bearer ${token(owner)}` };
    const otherHeaders = { authorization: `Bearer ${token(other)}` };
    const status = await request(server, `/api/v1/repositories/${repositoryId}/status`, { headers: ownerHeaders });
    const overview = await request(server, `/api/v1/repositories/${repositoryId}/overview`, { headers: ownerHeaders });
    const otherStatus = await request(server, `/api/v1/repositories/${repositoryId}/status`, { headers: otherHeaders });
    assert.equal(status.status, 200);
    assert.equal(status.body.data.status, 'pending');
    assert.equal(overview.status, 409);
    assert.equal(otherStatus.status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
  }
});

test('startup recovery marks interrupted jobs failed', async () => {
  const user = await prisma.user.create({ data: { name: 'Recovery Owner', email: `recovery-${crypto.randomUUID()}@example.com`, password: 'test' } });
  const repositoryId = `recovery-${crypto.randomUUID()}`;
  await createPendingRepository({ id: repositoryId, ownerId: user.id, sourceUrl: 'https://github.com/example/recovery.git', sourceKey: `github:example/recovery-${repositoryId}` });
  await updateRepositoryLifecycle(repositoryId, { status: 'analyzing', phase: 'indexing' });
  try {
    await recoverInterruptedRepositories();
    const recovered = await prisma.repository.findUnique({ where: { id: repositoryId } });
    assert.equal(recovered.status, 'failed');
    assert.equal(recovered.lastErrorCode, 'PROCESS_INTERRUPTED');
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('internal local Git fixture completes the existing analysis pipeline', async () => {
  const source = await fs.mkdtemp(path.join(os.tmpdir(), 'thinkbeyond-m22-source-'));
  const repositoryId = `fixture-${crypto.randomUUID()}`;
  try {
    await fs.writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'm22-fixture', scripts: {} }), 'utf8');
    await fs.writeFile(path.join(source, 'index.ts'), 'export const answer = 42;\n', 'utf8');
    execFileSync('git', ['init'], { cwd: source, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'm22@example.com'], { cwd: source, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'M22 Test'], { cwd: source, stdio: 'ignore' });
    execFileSync('git', ['add', '.'], { cwd: source, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'fixture'], { cwd: source, stdio: 'ignore' });

    const phases = [];
    await runRepositoryAnalysis(repositoryId, 'internal-test-owner', source, async phase => phases.push(phase));
    const state = await loadRepositoryExplorerState(repositoryId);
    assert.ok(state);
    assert.ok(state.workspaces.length >= 1);
    assert.ok(phases.includes('indexing'));
    assert.ok(phases.includes('snapshot'));
  } finally {
    await fs.rm(source, { recursive: true, force: true });
    await fs.rm(getRepositoryRootPath(repositoryId), { recursive: true, force: true });
  }
});

test('retry is owner-scoped and resets only the owned failed lifecycle', async () => {
  const owner = await prisma.user.create({ data: { name: 'Retry Owner', email: `retry-${crypto.randomUUID()}@example.com`, password: 'test' } });
  const other = await prisma.user.create({ data: { name: 'Retry Other', email: `retry-other-${crypto.randomUUID()}@example.com`, password: 'test' } });
  const repositoryId = `retry-${crypto.randomUUID()}`;
  await createPendingRepository({ id: repositoryId, ownerId: owner.id, sourceUrl: 'https://github.com/example/retry.git', sourceKey: `github:example/retry-${repositoryId}` });
  await updateRepositoryLifecycle(repositoryId, { status: 'failed', phase: 'failed', lastErrorCode: 'ANALYSIS_FAILED', lastErrorMessage: 'Repository analysis failed. Retry the import to try again.' });
  try {
    assert.equal(await retryRepositoryImport(repositoryId, other.id, { enqueue: false }), null);
    const retried = await retryRepositoryImport(repositoryId, owner.id, { enqueue: false });
    assert.equal(retried.status, 'pending');
    assert.equal(retried.lastErrorCode, null);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
  }
});

test('startup recovery preserves a job with a live lease', async () => {
  const user = await prisma.user.create({ data: { name: 'Live Lease Owner', email: `live-lease-${crypto.randomUUID()}@example.com`, password: 'test' } });
  const repositoryId = `live-lease-${crypto.randomUUID()}`;
  await createPendingRepository({ id: repositoryId, ownerId: user.id, sourceUrl: 'https://github.com/example/live-lease.git', sourceKey: `github:example/live-lease-${repositoryId}` });
  await claimPendingRepository(repositoryId, 'live-worker', 1, new Date(), new Date(Date.now() + 60000));
  try {
    await recoverInterruptedRepositories();
    const current = await prisma.repository.findUnique({ where: { id: repositoryId } });
    assert.equal(current.status, 'cloning');
    assert.equal(current.leaseOwner, 'live-worker');
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('stale workers cannot transition a row after lease ownership changes', async () => {
  const user = await prisma.user.create({ data: { name: 'Lease Owner', email: `lease-owner-${crypto.randomUUID()}@example.com`, password: 'test' } });
  const repositoryId = `lease-guard-${crypto.randomUUID()}`;
  await createPendingRepository({ id: repositoryId, ownerId: user.id, sourceUrl: 'https://github.com/example/lease-guard.git', sourceKey: `github:example/lease-guard-${repositoryId}` });
  await claimPendingRepository(repositoryId, 'new-worker', 1, new Date(), new Date(Date.now() + 60000));
  try {
    const staleUpdate = await updateOwnedRepositoryLifecycle(repositoryId, 'old-worker', { status: 'ready', phase: 'completed' });
    assert.equal(staleUpdate.count, 0);
    const current = await prisma.repository.findUnique({ where: { id: repositoryId } });
    assert.equal(current.status, 'cloning');
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('production worker executes success and failure paths without leaving active rows', async () => {
  const user = await prisma.user.create({ data: { name: 'Worker Owner', email: `worker-${crypto.randomUUID()}@example.com`, password: 'test' } });
  const source = await fs.mkdtemp(path.join(os.tmpdir(), 'thinkbeyond-m22-worker-'));
  const successId = `worker-success-${crypto.randomUUID()}`;
  const failureId = `worker-failure-${crypto.randomUUID()}`;
  try {
    await fs.writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'worker-fixture' }), 'utf8');
    await fs.writeFile(path.join(source, 'index.ts'), 'export const worker = true;\n', 'utf8');
    execFileSync('git', ['init'], { cwd: source, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'worker@example.com'], { cwd: source, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Worker Test'], { cwd: source, stdio: 'ignore' });
    execFileSync('git', ['add', '.'], { cwd: source, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'worker-fixture'], { cwd: source, stdio: 'ignore' });
    await createPendingRepository({ id: successId, ownerId: user.id, sourceUrl: source, sourceKey: `internal:success-${successId}` });
    await createPendingRepository({ id: failureId, ownerId: user.id, sourceUrl: path.join(source, 'missing'), sourceKey: `internal:failure-${failureId}` });
    assert.equal(enqueueRepositoryForAnalysis(successId), true);
    assert.equal(enqueueRepositoryForAnalysis(failureId), true);
    const drained = await drainRepositoryWorkers(15000);
    assert.equal(drained.timedOut, false);
    const success = await prisma.repository.findUnique({ where: { id: successId } });
    const failure = await prisma.repository.findUnique({ where: { id: failureId } });
    assert.equal(success.status, 'ready');
    assert.equal(failure.status, 'failed');
  } finally {
    await fs.rm(source, { recursive: true, force: true });
    await fs.rm(getRepositoryRootPath(successId), { recursive: true, force: true });
    await fs.rm(getRepositoryRootPath(failureId), { recursive: true, force: true });
    await prisma.user.delete({ where: { id: user.id } });
  }
});