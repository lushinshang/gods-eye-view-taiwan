// Positive and negative controls for panel_request against REAL downstream
// handlers — not the synthetic fetchImpl used elsewhere in
// panelRequest.test.mjs. Closes the GEV-C-004 gap: existing coverage proved
// requests get refused, but never that a legitimate call actually succeeds
// end to end through a real handler.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { writeFile, rm } from 'node:fs/promises';
import { createServer } from 'vite';
import { composeCatalog, coreTools } from '../index.js';
import { localProviderPlugins } from '../../../server/providers/local.js';
import { apiNotFoundPlugin } from '../../../server/standalone/api-not-found.js';
import { makeFixtureRoot } from '../../tooling/fixtureRoot.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const KEY = 'panel-key-for-tests';
const fromBase64 = (text) => Buffer.from(text, 'base64');

/** A real Vite dev server with every real provider wired in — not a mock. */
async function startRealServer(t) {
  const root = await makeFixtureRoot('gev-panel-request-real-');
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(root, 'index.html'),
    '<!doctype html><title>Real-handler fixture</title>',
  );
  const nominatimStorageDir = await makeFixtureRoot('gev-panel-request-nominatim-');
  t.after(() => rm(nominatimStorageDir, { recursive: true, force: true }));

  // Let /api/cctv/sources answer offline, with no real upstream.
  for (const [name, value] of Object.entries({
    CCTV_FORCE_AUSTIN: '0',
    CCTV_SOURCES_FILE: path.join(root, 'absent-sources.json'),
    CCTV_SOURCES_JSON: JSON.stringify([
      { id: 'fixture-cam', lat: 30.27, lon: -97.74 },
    ]),
  })) {
    const before = process.env[name];
    process.env[name] = value;
    t.after(() => {
      if (before === undefined) delete process.env[name];
      else process.env[name] = before;
    });
  }

  // Refuse any request this test didn't expect to leave the machine.
  const nativeFetch = globalThis.fetch;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (raw, options) => {
    const url = new URL(raw);
    if (url.hostname === '127.0.0.1') return nativeFetch(raw, options);
    throw new Error(`unexpected external fetch in test: ${url.origin}`);
  });
  t.after(() => fetchMock.mock.restore());

  const server = await createServer({
    root,
    configFile: false,
    envFile: false,
    publicDir: false,
    logLevel: 'silent',
    plugins: [...localProviderPlugins({ nominatimStorageDir }), apiNotFoundPlugin()],
    server: { host: '127.0.0.1', port: 0, hmr: false },
  });
  await server.listen();
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;

  const catalog = composeCatalog({
    tools: coreTools,
    services: {
      app: {
        baseUrl: origin + '/',
        fetch: (requestPath, init) => fetch(origin + requestPath, init),
        panelKey: KEY,
      },
    },
  });
  return catalog;
}

test('positive control: panel_request succeeds end to end against the real cctv/sources handler', async (t) => {
  const catalog = await startRealServer(t);
  const { data } = await catalog.call('panel_request', {
    key: KEY,
    path: '/api/cctv/sources',
  });
  assert.equal(data.status, 200);
  assert.equal(data.headers['content-type'], 'application/json');
  const body = JSON.parse(new TextDecoder().decode(fromBase64(data.body)));
  assert.ok(Array.isArray(body.sources));
  assert.ok(body.sources.some((source) => source.id === 'fixture-cam'));
});

test('GEV-C-004: sameSiteGated on /api/mapillary/status does not block panel_request (loopback tool call, not a cross-site browser)', async (t) => {
  // mapillary.js wraps its status handler in sameSiteGated, a DIFFERENT gate
  // from isLocalBrowser/PAT: it refuses cross-site BROWSER requests (foreign
  // Origin, Sec-Fetch-Site) but explicitly passes loopback non-browser
  // callers through. panelRequest's own fetch to the app's server is such a
  // caller, so this route has NO independent defense against the panel
  // path specifically — only against a malicious webpage calling it directly.
  const catalog = await startRealServer(t);
  const { data } = await catalog.call('panel_request', {
    key: KEY,
    path: '/api/mapillary/status',
  });
  assert.equal(data.status, 200);
  const body = JSON.parse(new TextDecoder().decode(fromBase64(data.body)));
  assert.equal(body.configured, false);
});

test('negative control: the real taiwan-ai-status handler itself refuses an uncredentialed call (not panelRequest\'s own REFUSED_PATHS)', async (t) => {
  const catalog = await startRealServer(t);
  // /api/taiwan-ai-status is not in panelRequest.js's REFUSED_PATHS list —
  // the refusal below must come from the downstream handler's own gate
  // (isLocalBrowser + PAT check), proving the tool-layer allowlist alone
  // does not protect this route; the real handler's auth does.
  const { data } = await catalog.call('panel_request', {
    key: KEY,
    path: '/api/taiwan-ai-status',
  });
  assert.equal(data.status, 401);
  const body = JSON.parse(new TextDecoder().decode(fromBase64(data.body)));
  assert.match(body.error, /Local same-origin browser or valid Bearer PAT required/);
});

// GEV-C-004 full coverage: every route security-assessment-report/qa/
// c004-route-contract.mjs classified as "allowed to the panel, no own auth
// gate" (40 of them, re-derived there by actually calling panelRequest.run,
// not hand-copied here) gets called end to end through the real server, not
// just grouped by static analysis. External upstream calls are blocked by
// the same fetch mock startRealServer always installs — these routes are
// not expected to return real provider data (no API keys are configured in
// this environment); what each assertion below checks is that panelRequest
// let the call through to the real handler and that handler's own response
// is not the specific 401/403 shape isLocalBrowser/PAT or sameSiteGated
// produce. A 404/500/502 from a route failing without real upstream
// credentials still proves the absence of that app-level auth gate.
const routeContractPath = fileURLToPath(
  new URL(
    '../../../../security-assessment-report/qa/c004-route-contract.json',
    import.meta.url,
  ),
);
const NO_GATE_ROUTES = JSON.parse(readFileSync(routeContractPath, 'utf8'))
  .rows.filter((r) => !r.panel_refused && !r.has_own_auth_gate)
  .map((r) => r.route);

test('GEV-C-004 full coverage: every route classified as having no own auth gate reaches the real handler without an isLocalBrowser/PAT or sameSiteGated refusal', async (t) => {
  assert.ok(
    NO_GATE_ROUTES.length >= 39,
    `expected around 40 no-gate routes from the live contract audit, got ${NO_GATE_ROUTES.length}`,
  );
  const catalog = await startRealServer(t);
  const results = [];
  for (const route of NO_GATE_ROUTES) {
    try {
      const { data } = await catalog.call('panel_request', {
        key: KEY,
        path: route,
      });
      results.push({ route, status: data.status, body: data.body });
    } catch (error) {
      results.push({ route, error: error.message });
    }
  }
  const misclassified = results.filter(
    (r) => r.error?.includes('is not available') || r.status === 401 || r.status === 403,
  );
  assert.deepEqual(
    misclassified.map((r) => ({ route: r.route, status: r.status, error: r.error })),
    [],
    'route(s) refused with a denylist or auth-style status despite being classified as having no own auth gate',
  );
});
