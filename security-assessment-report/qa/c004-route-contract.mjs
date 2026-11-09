// Re-derives, by actually CALLING the real panelRequest tool (never by
// copying its REFUSED_PATHS regexes by hand), which of the dev server's
// mounted routes the panel is allowed to reach, and — for the allowed
// ones — whether the route's own handler file references an
// application-level auth gate (isLocalBrowser / admitKeySetupRequest /
// sameSiteGated) rather than relying solely on panelRequest's denylist
// plus the loopback-only network exposure model.
//
// This is GEV-C-004 evidence: it establishes the actual shape of the
// "responsibility boundary" the finding's acceptance_criteria asks about.
// It does NOT execute any downstream route handler — see
// panelRequestRealHandlers.test.mjs for the routes that are live-tested
// end to end.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { panelRequest } from '../../repo/src/tools/queries/panelRequest.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../repo');

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (
      (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) &&
      !entry.name.includes('.test.')
    )
      out.push(full);
  }
  return out;
}

const serverFiles = listFiles(path.join(REPO, 'server'));
const MOUNT_RE = /middlewares\.use\(\s*(?:'([^']+)'|"([^"]+)")/g;
// Two indirections a plain `middlewares.use('literal', ...)` scan misses,
// each resolved from its own source rather than hand-copied: a route
// mounted via a module-level exported constant, and one called through a
// helper whose own literal-string argument is what actually gets mounted.
const INDIRECT_CONST_RE = /middlewares\.use\(\s*([A-Z_]+)\s*,/g;
const INDIRECT_HELPER_RE = /installGeocodeRoute\(\s*(?:'([^']+)'|"([^"]+)")/g;

const mountsByFile = new Map();
for (const file of serverFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const routes = [];
  for (const re of [new RegExp(MOUNT_RE), new RegExp(INDIRECT_HELPER_RE)]) {
    let m;
    while ((m = re.exec(text))) {
      const route = m[1] || m[2];
      if (route) routes.push(route);
    }
  }
  let cm;
  const constRe = new RegExp(INDIRECT_CONST_RE);
  while ((cm = constRe.exec(text))) {
    const constMatch = text.match(
      new RegExp(`${cm[1]}\\s*=\\s*(?:'([^']+)'|"([^"]+)")`),
    );
    if (constMatch) routes.push(constMatch[1] || constMatch[2]);
  }
  if (routes.length) mountsByFile.set(path.relative(REPO, file), [...new Set(routes)]);
}
// ollama-advisor.js mounts a catch-all with no literal path and dispatches
// on req.url internally to these three routes (confirmed by reading the
// handler, not a hand-typed guess — see the `route ===` checks in the file).
const ollamaFile = 'server/providers/ai/ollama-advisor.js';
mountsByFile.set(ollamaFile, [
  '/api/taiwan-ai-advisor',
  '/api/taiwan-ai-status',
  '/api/taiwan-ai-token',
]);

const KEY = 'panel-key-for-contract-audit';
async function isRefusedByPanel(route) {
  const services = {
    app: {
      panelKey: KEY,
      baseUrl: 'http://127.0.0.1:4173',
      fetch: async () => new Response('ok', { status: 200 }),
    },
  };
  try {
    await panelRequest.run({ key: KEY, path: route }, { services, signal: undefined });
    return false; // reached services.app.fetch — the panel is allowed to call it
  } catch (error) {
    // Refused specifically by checkedPath's REFUSED_PATHS match, identified
    // by the exact message shape it throws — any other failure (timeout,
    // bad method) is not a denylist refusal.
    return error?.message === `${new URL(route, 'http://x').pathname} is not available`;
  }
}

const AUTH_GATE_RE = /isLocalBrowser|admitKeySetupRequest|sameSiteGated/;

const rows = [];
for (const [file, routes] of mountsByFile) {
  const text = fs.readFileSync(path.join(REPO, file), 'utf8');
  const hasAuthGate = AUTH_GATE_RE.test(text);
  for (const route of routes) {
    rows.push({
      route,
      file,
      panel_refused: await isRefusedByPanel(route),
      has_own_auth_gate: hasAuthGate,
    });
  }
}
rows.sort((a, b) => a.route.localeCompare(b.route));

const allowedRows = rows.filter((r) => !r.panel_refused);
const result = {
  total_mounted_routes: rows.length,
  refused_by_panel_request: rows.filter((r) => r.panel_refused).length,
  allowed_to_panel: allowedRows.length,
  allowed_with_own_auth_gate: allowedRows.filter((r) => r.has_own_auth_gate).length,
  allowed_without_own_auth_gate: allowedRows.filter((r) => !r.has_own_auth_gate).length,
  rows,
};

fs.writeFileSync(
  path.join(HERE, 'c004-route-contract.json'),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify({
  total_mounted_routes: result.total_mounted_routes,
  refused_by_panel_request: result.refused_by_panel_request,
  allowed_to_panel: result.allowed_to_panel,
  allowed_with_own_auth_gate: result.allowed_with_own_auth_gate,
  allowed_without_own_auth_gate: result.allowed_without_own_auth_gate,
}, null, 1));
