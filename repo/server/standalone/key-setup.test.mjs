import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { keySetupEndpoint } from './key-setup.js';

/**
 * A real TCP server (not a mocked single-chunk Readable) so the body
 * actually streams in over a socket, matching how `req.destroy()` behaves
 * against a live connection — this is what proved the bug dynamically in
 * sdd/archive/2026-11-09-active-pentest-localhost/run_all.py.
 */
function startServer(sourceRoot) {
  const plugin = keySetupEndpoint({ sourceRoot });
  const routes = new Map();
  plugin.configureServer({
    middlewares: { use: (route, handler) => routes.set(route, handler) },
    restart: async () => {},
  });
  const server = http.createServer((req, res) => {
    const handler = routes.get(req.url.split('?')[0]);
    if (!handler) {
      res.writeHead(404).end();
      return;
    }
    handler(req, res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function postOversized(port, bytes) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/setup/keys',
        method: 'POST',
        headers: {
          Origin: `http://127.0.0.1:${port}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }),
        );
      },
    );
    req.on('error', (error) => reject(error));
    req.end('{"OPENAI_API_KEY":"' + 'x'.repeat(bytes) + '"}');
  });
}

test('POST /api/setup/keys over the 8192-byte cap responds 413 instead of resetting the connection', async (t) => {
  const sourceRoot = mkdtempSync(path.join(tmpdir(), 'gev-key-setup-'));
  t.after(() => rmSync(sourceRoot, { recursive: true, force: true }));
  const server = await startServer(sourceRoot);
  t.after(() => server.close());
  const { port } = server.address();

  const result = await postOversized(port, 20000);
  assert.equal(result.status, 413);
  assert.deepEqual(JSON.parse(result.body), {
    error: 'Request too large',
    code: 'too-large',
  });
});
