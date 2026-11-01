const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const {
  getRepositoryRootPath,
  validateRepositoryId,
  saveRepositoryExplorerState,
} = require('../dist/services/repository-explorer-state.service.js');

test('validateRepositoryId rejects path traversal input', () => {
  assert.throws(() => validateRepositoryId('../escape'), /invalid characters/i);
  assert.throws(() => validateRepositoryId('..\\escape'), /invalid characters/i);
  assert.throws(() => validateRepositoryId('/absolute/path'), /invalid characters/i);
  assert.throws(() => validateRepositoryId('repo%2f..%2fescape'), /invalid characters/i);
});

test('getRepositoryRootPath keeps repository storage inside the temp directory', () => {
  const root = getRepositoryRootPath('123e4567-e89b-12d3-a456-426614174000');
  assert.match(root, /temp[\\/]repositories[\\/]123e4567-e89b-12d3-a456-426614174000$/);
});

test('loadRepositoryExplorerState ignores a snapshot repositoryPath outside storage', async () => {
  const repositoryId = 'security-test-repository';
  const root = getRepositoryRootPath(repositoryId);
  const snapshotPath = path.join(root, 'analysis.json');
  const snapshot = {
    repositoryId,
    repositoryPath: path.resolve('..', '..', 'outside'),
    summary: {},
    knowledge: {},
    workspaces: [],
  };

  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot), 'utf8');

  const { loadRepositoryExplorerState } = require('../dist/services/repository-explorer-state.service.js');
  const state = await loadRepositoryExplorerState(repositoryId);

  assert.equal(state.repositoryPath, root);
  await fs.rm(root, { recursive: true, force: true });
});

test('loadRepositoryExplorerState rejects a repository root symlink outside storage', async (t) => {
  const repositoryId = 'root-symlink-security-test';
  const root = getRepositoryRootPath(repositoryId);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'thinkbeyond-root-outside-'));

  try {
    await fs.mkdir(path.dirname(root), { recursive: true });
    await fs.symlink(outside, root, 'junction');
  } catch (error) {
    await fs.rm(outside, { recursive: true, force: true });
    if (error && ['EPERM', 'EACCES', 'UNKNOWN'].includes(error.code)) {
      t.skip('symlink creation is unavailable in this Windows environment');
      return;
    }
    throw error;
  }

  try {
    const { loadRepositoryExplorerState } = require('../dist/services/repository-explorer-state.service.js');
    assert.equal(await loadRepositoryExplorerState(repositoryId), null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

test('repository tree skips symlink entries that could escape the repository root', async (t) => {
  const { buildRepositoryTree } = require('../dist/services/repository-tree.service.js');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'thinkbeyond-tree-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'thinkbeyond-outside-'));

  await fs.writeFile(path.join(outside, 'secret.txt'), 'secret', 'utf8');

  try {
    await fs.symlink(outside, path.join(root, 'linked-outside'), 'junction');
  } catch (error) {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
    if (error && ['EPERM', 'EACCES', 'UNKNOWN'].includes(error.code)) {
      t.skip('symlink creation is unavailable in this Windows environment');
      return;
    }
    throw error;
  }

  const tree = await buildRepositoryTree(root);
  assert.equal(tree.some(node => node.name === 'linked-outside'), false);

  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(outside, { recursive: true, force: true });
});

test('production configuration rejects weak JWT secrets and allows explicit offline AI', () => {
  const baseEnv = {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://localhost/thinkbeyond',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    AI_PROVIDER: 'offline',
    CORS_ORIGIN: 'https://app.example.com',
  };

  execFileSync(process.execPath, ['-e', 'require("./dist/config/env.js")'], {
    cwd: path.join(__dirname, '..'),
    env: baseEnv,
  });

  assert.throws(() => execFileSync(process.execPath, ['-e', 'require("./dist/config/env.js")'], {
    cwd: path.join(__dirname, '..'),
    env: { ...baseEnv, JWT_ACCESS_SECRET: 'weak' },
    stdio: 'pipe',
  }), /JWT_ACCESS_SECRET must be at least 32 characters/i);
});

test('production repository routes reject missing and invalid bearer tokens', () => {
  const script = `
    const http = require('node:http');
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://localhost/thinkbeyond';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    process.env.AI_PROVIDER = 'offline';
    process.env.CORS_ORIGIN = 'https://app.example.com';
    const app = require('./dist/app.js').default;
    const server = http.createServer(app);
    server.listen(0, async () => {
      const port = server.address().port;
      const request = (headers = {}) => fetch('http://127.0.0.1:' + port + '/api/v1/repositories/missing/overview', { headers }).then(response => response.status);
      const missing = await request();
      const invalid = await request({ authorization: 'Bearer invalid' });
      console.log(JSON.stringify({ missing, invalid }));
      server.close();
    });
  `;

  const output = execFileSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    encoding: 'utf8',
  });

  assert.deepEqual(JSON.parse(output.trim().split(/\r?\n/).pop()), { missing: 401, invalid: 401 });
});

test('saveRepositoryExplorerState replaces an existing snapshot without losing the previous valid state', async () => {
  const repositoryId = 'snapshot-replacement-test';
  const root = getRepositoryRootPath(repositoryId);
  const state = (summaryName) => ({
    repositoryId,
    repositoryPath: root,
    summary: { name: summaryName },
    knowledge: {},
    workspaces: [{
      name: 'workspace',
      relativePath: '.',
      globalSymbolTable: new Map(),
      sourceFiles: [],
    }],
  });

  await saveRepositoryExplorerState(state('first'));
  await saveRepositoryExplorerState(state('second'));
  const loaded = await fs.readFile(path.join(root, 'analysis.json'), 'utf8');
  assert.equal(JSON.parse(loaded).summary.name, 'second');
  assert.equal(await fs.access(`${path.join(root, 'analysis.json')}.previous`).then(() => true).catch(() => false), false);
  await fs.rm(root, { recursive: true, force: true });
});

test('loadRepositoryExplorerState recovers a valid backup after interrupted replacement', async () => {
  const repositoryId = 'snapshot-backup-recovery-test';
  const root = getRepositoryRootPath(repositoryId);
  const snapshotPath = path.join(root, 'analysis.json');
  const backupPath = `${snapshotPath}.previous`;
  const backup = {
    repositoryId,
    repositoryPath: root,
    summary: { recovered: true },
    knowledge: {},
    workspaces: [],
  };

  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(snapshotPath, '{invalid', 'utf8');
  await fs.writeFile(backupPath, JSON.stringify(backup), 'utf8');
  const { loadRepositoryExplorerState } = require('../dist/services/repository-explorer-state.service.js');
  const recovered = await loadRepositoryExplorerState(repositoryId);

  assert.equal(recovered.summary.recovered, true);
  await fs.rm(root, { recursive: true, force: true });
});

test('snapshot backup cleanup failure preserves the installed snapshot and logs the failure', async () => {
  const repositoryId = 'snapshot-cleanup-failure-test';
  const root = getRepositoryRootPath(repositoryId);
  const snapshotPath = path.join(root, 'analysis.json');
  const originalRm = fs.rm;
  const originalWarn = console.warn;
  let backupCleanupCalls = 0;
  const warnings = [];

  await originalRm(root, { recursive: true, force: true });

  fs.rm = async (target, options) => {
    if (String(target).endsWith('.previous')) {
      backupCleanupCalls += 1;
      if (backupCleanupCalls === 3) {
        throw new Error('simulated backup cleanup failure');
      }
    }
    return originalRm(target, options);
  };
  console.warn = (...args) => warnings.push(args.join(' '));

  const state = (name) => ({
    repositoryId,
    repositoryPath: root,
    summary: { name },
    knowledge: {},
    workspaces: [{ name: 'workspace', relativePath: '.', globalSymbolTable: new Map(), sourceFiles: [] }],
  });

  try {
    await saveRepositoryExplorerState(state('first'));
    await saveRepositoryExplorerState(state('second'));
    assert.equal(JSON.parse(await fs.readFile(snapshotPath, 'utf8')).summary.name, 'second');
    assert.equal(warnings.some(message => message.includes('repository.snapshot_backup_cleanup_failed')), true);
    assert.equal(await fs.access(root).then(() => true), true);
  } finally {
    fs.rm = originalRm;
    console.warn = originalWarn;
    await originalRm(root, { recursive: true, force: true });
  }
});