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
const { createRepository } = require('../dist/repositories/repository.repository.js');
const { getRepositoryRootPath } = require('../dist/services/repository-explorer-state.service.js');

const accessSecret = process.env.JWT_ACCESS_SECRET || 'integration-access-secret';

function token(user) {
  return jwt.sign({ userId: user.id, email: user.email }, accessSecret);
}

async function request(server, route, options = {}) {
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}${route}`, options);
  const body = await response.json();
  return { status: response.status, body };
}

async function createSnapshot(repositoryId) {
  const root = getRepositoryRootPath(repositoryId);
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'analysis.json'), JSON.stringify({
    repositoryId,
    repositoryPath: root,
    summary: {},
    knowledge: {
      metrics: {
        totalFiles: 0,
        totalSymbols: 0,
        totalFunctions: 0,
        totalClasses: 0,
        totalInterfaces: 0,
        totalEnums: 0,
        totalDependencies: 0,
        totalFunctionCalls: 0,
        deadCodeCount: 0,
      },
      health: { score: 100, breakdown: { circularPenalty: 0, deadCodePenalty: 0, dependencyPenalty: 0 } },
      deadCode: { unusedFunctions: [], unusedExportedFunctions: [], unreachableFunctions: [] },
      callGraph: { edges: [] },
    },
    workspaces: [],
  }), 'utf8');
}

test('repository ownership is enforced with persisted users and repositories', async (t) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.repository.count();
  } catch (error) {
    throw new Error('Ownership integration tests require PostgreSQL and the applied migration', { cause: error });
  }

  const suffix = crypto.randomUUID();
  const owner = await prisma.user.create({
    data: { name: 'Repository Owner', email: `owner-${suffix}@example.com`, password: 'test-password' },
  });
  const other = await prisma.user.create({
    data: { name: 'Other User', email: `other-${suffix}@example.com`, password: 'test-password' },
  });
  const repositoryId = `ownership-${suffix}`;
  await createRepository(repositoryId, owner.id);
  await createSnapshot(repositoryId);

  const app = require('../dist/app.js').default;
  const server = require('node:http').createServer(app);
  await new Promise(resolve => server.listen(0, resolve));

  try {
    const ownerResponse = await request(server, `/api/v1/repositories/${repositoryId}/overview`, {
      headers: { authorization: `Bearer ${token(owner)}` },
    });
    const otherResponse = await request(server, `/api/v1/repositories/${repositoryId}/overview`, {
      headers: { authorization: `Bearer ${token(other)}` },
    });
    const anonymousResponse = await request(server, `/api/v1/repositories/${repositoryId}/overview`);

    assert.equal(ownerResponse.status, 200);
    assert.equal(otherResponse.status, 404);
    assert.equal(anonymousResponse.status, 401);
    assert.equal(ownerResponse.body.message, 'Repository overview loaded successfully');
    assert.equal(otherResponse.body.message, 'Repository not found');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(getRepositoryRootPath(repositoryId), { recursive: true, force: true });
    await prisma.repository.deleteMany({ where: { id: repositoryId } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
  }
});

test('authenticated repository import persists the authenticated owner', async (t) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.repository.count();
  } catch (error) {
    throw new Error('Ownership integration tests require PostgreSQL and the applied migration', { cause: error });
  }

  const suffix = crypto.randomUUID();
  const owner = await prisma.user.create({
    data: { name: 'Import Owner', email: `import-${suffix}@example.com`, password: 'test-password' },
  });
  const source = await fs.mkdtemp(path.join(os.tmpdir(), 'thinkbeyond-import-'));
  const app = require('../dist/app.js').default;
  const server = require('node:http').createServer(app);
  await new Promise(resolve => server.listen(0, resolve));

  try {
    await fs.writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'ownership-test' }), 'utf8');
    execFileSync('git', ['init'], { cwd: source, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: source, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Ownership Test'], { cwd: source, stdio: 'ignore' });
    execFileSync('git', ['add', '.'], { cwd: source, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: source, stdio: 'ignore' });

    const imported = await request(server, '/api/v1/repositories/import', {
      method: 'POST',
      headers: { authorization: `Bearer ${token(owner)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url: source }),
    });

    assert.equal(imported.status, 201);
    const repositoryId = imported.body.data.repositoryId;
    const persisted = await prisma.repository.findUnique({ where: { id: repositoryId } });
    assert.equal(persisted.ownerId, owner.id);

    await fs.rm(getRepositoryRootPath(repositoryId), { recursive: true, force: true });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(source, { recursive: true, force: true });
    await prisma.user.deleteMany({ where: { id: owner.id } });
  }
});

test('legacy snapshots without an ownership row remain inaccessible', async (t) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.repository.count();
  } catch (error) {
    throw new Error('Ownership integration tests require PostgreSQL and the applied migration', { cause: error });
  }

  const repositoryId = `legacy-${crypto.randomUUID()}`;
  await createSnapshot(repositoryId);
  const app = require('../dist/app.js').default;
  const server = require('node:http').createServer(app);
  await new Promise(resolve => server.listen(0, resolve));

  try {
    const response = await request(server, `/api/v1/repositories/${repositoryId}/overview`, {
      headers: { authorization: `Bearer ${jwt.sign({ userId: 'legacy-test-user', email: 'legacy@example.com' }, accessSecret)}` },
    });
    assert.equal(response.status, 404);
    assert.equal(await prisma.repository.findUnique({ where: { id: repositoryId } }), null);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(getRepositoryRootPath(repositoryId), { recursive: true, force: true });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});