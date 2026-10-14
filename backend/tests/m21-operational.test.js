const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createShutdownHandler } = require('../dist/services/shutdown.service.js');
const { createReadinessChecker } = require('../dist/services/health.service.js');

const app = require('../dist/app.js').default;

function startServer() {
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

async function request(server, path, options = {}) {
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : {} };
}

test('liveness is unauthenticated, lightweight, and correlated', async () => {
  const server = await startServer();
  try {
    const { response, body } = await request(server, '/api/v1/health/live');
    assert.equal(response.status, 200);
    assert.equal(body.data.status, 'alive');
    assert.match(response.headers.get('x-request-id'), /^[A-Za-z0-9-]{36}$/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('valid request IDs propagate and invalid IDs are replaced', async () => {
  const server = await startServer();
  try {
    const valid = await request(server, '/api/v1/health/live', { headers: { 'x-request-id': 'trace-123' } });
    const invalid = await request(server, '/api/v1/health/live', { headers: { 'x-request-id': 'not valid' } });
    const oversized = await request(server, '/api/v1/health/live', { headers: { 'x-request-id': 'x'.repeat(129) } });

    assert.equal(valid.response.headers.get('x-request-id'), 'trace-123');
    assert.match(invalid.response.headers.get('x-request-id'), /^[A-Za-z0-9-]{36}$/);
    assert.match(oversized.response.headers.get('x-request-id'), /^[A-Za-z0-9-]{36}$/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('concurrent requests receive distinct correlation IDs', async () => {
  const server = await startServer();
  try {
    const responses = await Promise.all(Array.from({ length: 8 }, () => request(server, '/api/v1/health/live')));
    const ids = responses.map(({ response }) => response.headers.get('x-request-id'));
    assert.equal(new Set(ids).size, ids.length);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('readiness succeeds against the available PostgreSQL database', async () => {
  const server = await startServer();
  try {
    const { response, body } = await request(server, '/api/v1/health/ready');
    assert.equal(response.status, 200);
    assert.equal(body.message, 'ThinkBeyond API is ready');
    assert.equal(body.data.status, 'ready');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('readiness returns bounded safe failure without accumulating timed-out checks', async () => {
  let queryCount = 0;
  let releaseQuery;
  const checker = createReadinessChecker(() => {
    queryCount += 1;
    if (queryCount > 1) {
      return Promise.resolve();
    }
    return new Promise(resolve => { releaseQuery = resolve; });
  }, 20);

  const results = await Promise.all([checker(), checker(), checker()]);
  assert.deepEqual(results, [{ ready: false }, { ready: false }, { ready: false }]);
  assert.equal(queryCount, 1);

  releaseQuery();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(await checker(), { ready: true });
});

test('failed readiness remains safe and bounded', async () => {
  const checker = createReadinessChecker(async () => {
    throw new Error('database credentials and connection details must stay private');
  }, 20);

  assert.deepEqual(await checker(), { ready: false });
});

test('malformed JSON returns a safe correlated client error', async () => {
  const server = await startServer();
  try {
    const { response, body } = await request(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid',
    });
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'stack'), false);
    assert.match(body.requestId, /^[A-Za-z0-9-]{36}$/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

function listen(server) {
  return new Promise(resolve => server.listen(0, () => resolve(server)));
}

function openHeldRequest(server) {
  const response = new Promise((resolve, reject) => {
    const request = http.get({ port: server.address().port, path: '/hold' }, res => {
      res.once('data', () => resolve({ request }));
    });
    request.once('error', reject);
  });

  return response;
}

function createDrainServer() {
  let releaseHold = () => undefined;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/hold') {
      res.writeHead(200);
      res.write('held');
      await new Promise(resolve => {
        releaseHold = () => {
          res.end();
          resolve();
        };
        res.once('close', resolve);
      });
      return;
    }
    res.end('ok');
  });

  server.releaseHold = () => releaseHold();
  return server;
}

test('shutdown rejects new connections once shutdown starts', async () => {
  const server = createDrainServer();
  await listen(server);
  const held = await openHeldRequest(server);
  const shutdown = createShutdownHandler(server, async () => undefined, 1000);
  const stopping = shutdown();

  await assert.rejects(new Promise((resolve, reject) => {
    const request = http.get({ port: server.address().port, path: '/quick' }, resolve);
    request.once('error', reject);
  }));

  held.request.destroy();
  server.releaseHold();
  assert.deepEqual(await stopping, { timedOut: false, disconnectFailed: false });
});

test('shutdown drains active requests before disconnecting', async () => {
  const server = createDrainServer();
  await listen(server);
  const held = await openHeldRequest(server);
  let disconnected = false;
  const shutdown = createShutdownHandler(server, async () => { disconnected = true; }, 1000);
  const stopping = shutdown();

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(disconnected, false);
  server.releaseHold();
  held.request.destroy();
  assert.deepEqual(await stopping, { timedOut: false, disconnectFailed: false });
  assert.equal(disconnected, true);
});

test('shutdown enforces its timeout for requests that do not drain', async () => {
  const server = createDrainServer();
  await listen(server);
  const held = await openHeldRequest(server);
  const shutdown = createShutdownHandler(server, async () => undefined, 20);

  assert.deepEqual(await shutdown(), { timedOut: true, disconnectFailed: false });
  held.request.destroy();
});

test('shutdown handles Prisma disconnect failure without hanging', async () => {
  const server = http.createServer((_req, res) => res.end('ok'));
  await listen(server);
  const shutdown = createShutdownHandler(server, async () => {
    throw new Error('disconnect failed');
  }, 1000);

  assert.deepEqual(await shutdown(), { timedOut: false, disconnectFailed: true });
});

test('shutdown handler deduplicates cleanup and disconnects Prisma once', async () => {
  const server = http.createServer((_req, res) => res.end('ok'));
  await new Promise(resolve => server.listen(0, resolve));
  let disconnectCount = 0;
  const shutdown = createShutdownHandler(server, async () => { disconnectCount += 1; });

  const results = await Promise.all([shutdown(), shutdown(), shutdown()]);
  assert.equal(disconnectCount, 1);
  assert.deepEqual(results[0], { timedOut: false, disconnectFailed: false });
  assert.deepEqual(results[1], results[0]);
  assert.deepEqual(results[2], results[0]);
});