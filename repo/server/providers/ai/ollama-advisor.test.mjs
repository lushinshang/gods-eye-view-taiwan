import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { performance } from 'node:perf_hooks';
import { dataHealth, aisSpeed } from './data-health.js';
import { retrieve, parseIntent, AREAS } from './retriever.js';
import { buildPrompt, deterministicBrief } from './prompt.js';
import {
  runOllama,
  resolveModel,
  validateGrounding,
  inferenceBusy,
} from './ollama-client.js';
import {
  createTokenStore,
  createAdvisorMiddleware,
  isLocalBrowser,
} from './ollama-advisor.js';
const good = { status: 'ok', ageMs: 0 };
const vessel = (n = 0, extra = {}) => ({
  mmsi: String(416000000 + n),
  name: `REAL SHIP ${n}`,
  categoryKey: 'cargo',
  lat: 25.15,
  lon: 121.75,
  speed: 18,
  destination: 'FAKE DESTINATION',
  ...extra,
});
const fixtures = () => ({
  vessels: {
    rows: [
      vessel(),
      vessel(1, { speed: 102.3 }),
      vessel(2, { categoryKey: 'tanker', lat: 22.6, lon: 120.3 }),
    ],
    data_health: good,
  },
  traffic: {
    events: [
      {
        id: 'e1',
        type: 'accident',
        title: '事故',
        road: '國道一號',
        lat: 25.1,
        lon: 121.7,
        speedKmh: 20,
      },
    ],
    speeds: [
      {
        id: 's1',
        name: '汐止',
        road: '國道一號',
        lat: 25.1,
        lon: 121.7,
        speedKmh: 20,
      },
      {
        id: 's3',
        name: '南段',
        road: '國道三號',
        lat: 22.6,
        lon: 120.3,
        speedKmh: 80,
      },
    ],
    data_health: good,
  },
});
const promptFixture = () =>
  buildPrompt(
    retrieve({ ...fixtures(), query: '基隆港 貨輪 >15kt' }),
    '基隆港 貨輪 >15kt',
  );

test('health distinguishes missing, fresh, aged and failed caches; AIS sentinels are unknown', () => {
  assert.deepEqual(dataHealth(0, 40, false, 100), {
    status: 'source_error',
    ageMs: null,
  });
  assert.deepEqual(dataHealth(90, 40, false, 100), { status: 'ok', ageMs: 10 });
  assert.equal(dataHealth(50, 40, false, 100).status, 'stale');
  assert.equal(dataHealth(90, 40, true, 100).status, 'stale');
  for (const raw of [102.3, 102.4, -1, NaN, Infinity, null, '18'])
    assert.equal(aisSpeed(raw), null);
  assert.equal(aisSpeed(0), 0);
});
test('intent parses all ports/seas, roads, regions, eight categories, speed and MMSI/name/selection', () => {
  for (const name of Object.keys(AREAS))
    assert.equal(parseIntent(`${name} 半徑20公里`).area.radius_km, 20);
  const q = parseIntent(
    '基隆港 國1 國道三號 北部 貨輪 航速 > 15kt 車速 <40km/h MMSI 416000001',
  );
  assert.deepEqual(q.roads, ['1', '3']);
  assert.equal(q.region, 'north');
  assert.equal(q.min_speed_knots, 15);
  assert.equal(q.max_road_speed_kmh, 40);
  assert.equal(q.mmsi, '416000001');
  assert.equal(parseIntent('船名「REAL SHIP」').ship_name, 'REAL SHIP');
  assert.equal(parseIntent('航速 10 節以下').max_speed_knots, 10);
  assert.equal(parseIntent('', { vessel: vessel() }).mmsi, vessel().mmsi);
  assert.equal(
    parseIntent('', { event: { id: 'e1', lat: 25, lon: 121 } }).event_id,
    'e1',
  );
  assert.equal(
    parseIntent('貨輪 油輪 漁船 客輪 高速船 引水船 帆船 未分類')
      .vessel_categories.length,
    8,
  );
});
test('retrieval is pure, combines filters and flags without using AIS sentinel speeds', () => {
  const sources = fixtures(),
    original = JSON.stringify(sources);
  const result = retrieve({
    ...sources,
    query: '基隆港 半徑20公里 貨輪 >15kt',
  });
  assert.equal(result.matched_total.vessels, 1);
  assert.equal(result.vessels[0].mmsi, vessel().mmsi);
  assert.equal(result.summary.total_vessels, 3);
  assert.equal(result.summary.by_category.cargo, 2);
  assert.ok(result.flags.includes('severe_congestion'));
  assert.ok(result.flags.includes('accident'));
  assert.equal(JSON.stringify(sources), original);
  assert.equal(
    retrieve({ ...sources, query: '國3 南段 車速 <40km/h' }).matched_total
      .speeds,
    0,
  );
  assert.equal(
    retrieve({ ...sources, query: '416000001' }).vessels[0].speed,
    null,
  );
});
test('9000 vessels + 453 road sections yields Top-15 and accurate matched totals under 50 ms', () => {
  const sources = fixtures();
  sources.vessels.rows = Array.from({ length: 9000 }, (_, n) =>
    vessel(n, { speed: n % 40 }),
  );
  sources.traffic.speeds = Array.from({ length: 453 }, (_, n) => ({
    id: String(n),
    road: '國道一號',
    speedKmh: n % 100,
    lat: 25,
    lon: 121,
  }));
  retrieve(sources); // warm up JIT
  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const r = retrieve(sources);
    times.push(performance.now() - start);
    assert.equal(r.matched_total.vessels, 9000);
    assert.equal(r.vessels.length, 15);
    assert.equal(r.speeds.length, 15);
  }
  const median = times.sort((a, b) => a - b)[2];
  assert.ok(median < 50, `median ${median.toFixed(2)} ms`);
  console.log(
    `retriever median: ${median.toFixed(2)}ms (9000 vessels / 453 sections)`,
  );
});
test('context whitelist excludes fake destinations; UTF-8 byte upper bound stays within 3600', () => {
  const prompt = promptFixture();
  assert.ok(!prompt.text.includes('FAKE'));
  assert.ok(prompt.token_upper_bound <= 3600);
  assert.ok(
    prompt.context.vessels.length > 0,
    'must retain useful source detail',
  );
  assert.equal(
    prompt.token_upper_bound,
    prompt.messages.reduce((sum, m) => sum + Buffer.byteLength(m.content), 0),
  );
  const input = fixtures();
  input.vessels.rows = Array.from({ length: 50 }, (_, n) =>
    vessel(n, { name: '很長的中文船名'.repeat(50) }),
  );
  assert.ok(
    buildPrompt(retrieve(input), '很長的詢問'.repeat(300)).token_upper_bound <=
      3600,
  );
});
test('source_error never produces absence or zero-count claims; stale warns explicitly', () => {
  const result = retrieve({
    vessels: { rows: [], data_health: { status: 'source_error', ageMs: null } },
    traffic: {},
  });
  const p = buildPrompt(result);
  const brief = deterministicBrief(p.context);
  assert.match(brief, /來源異常/);
  assert.doesNotMatch(brief, /0 艘|無事故|0 件/);
  assert.equal(validateGrounding('沒有事故，0 艘船。', p), false);
  result.data_health.vessels = { status: 'stale', ageMs: 90000 };
  assert.match(deterministicBrief(buildPrompt(result).context), /已過期/);
});
test('grounding blocks fabricated names/MMSI/numbers and swapped facts, allows exact facts', () => {
  const p = promptFixture();
  const brief = deterministicBrief(p.context);
  assert.equal(validateGrounding(brief, p), true);
  for (const bad of [
    '',
    ' ',
    'MMSI 999999999 航速 999 節。',
    '船名「FAKE SHIP」，航速 18 節。',
    '港口無事故。',
  ])
    assert.equal(validateGrounding(bad, p), false, bad);
});
const kaohsiungFixture = () => {
  const near = Array.from({ length: 20 }, (_, n) =>
    vessel(n, {
      mmsi: String(416100000 + n),
      name: `高雄貨輪${n}號`,
      lat: 22.61 + n * 0.005, // within 18.52 km of 高雄港
      lon: 120.28,
      speed: n % 3 === 0 ? 0 : 8.5,
    }),
  );
  const far = vessel(99, { mmsi: '416199999', lat: 25.15, lon: 121.75 });
  const tanker = vessel(98, {
    mmsi: '416199998',
    categoryKey: 'tanker',
    lat: 22.61,
    lon: 120.28,
  });
  return {
    ...fixtures(),
    vessels: { rows: [...near, far, tanker], data_health: good },
  };
};
const KAOHSIUNG_Q = '高雄港附近10海浬有多少貨輪？';
test('nautical-mile units convert to km (rounded to 2 decimals), incl. Chinese numerals; focus detection', () => {
  const a = parseIntent(KAOHSIUNG_Q).area;
  assert.equal(a.name, '高雄港');
  assert.equal(a.radius_nm, 10);
  assert.equal(a.radius_km, 18.52);
  for (const q of [
    '高雄港 十海浬',
    '高雄港 10海里',
    '高雄港 10浬',
    '高雄港 10nm',
    '高雄港 10 nmi',
  ])
    assert.equal(parseIntent(q).area.radius_nm, 10, q);
  assert.equal(parseIntent('高雄港 二十五海浬').area.radius_nm, 25);
  assert.equal(parseIntent('高雄港 3.5海浬').area.radius_km, 6.48);
  assert.equal(parseIntent('高雄港 半徑20公里').area.radius_nm, undefined);
  assert.equal(parseIntent(KAOHSIUNG_Q).focus, 'maritime');
  assert.equal(parseIntent('哪艘油輪最快').focus, 'maritime');
  assert.equal(parseIntent('國道一號 車速 事故').focus, 'traffic');
  assert.equal(parseIntent('高雄港貨輪與國道3號事故').focus, 'both');
  assert.equal(parseIntent('現在整體態勢').focus, 'both');
});
test('Kaohsiung 10nm cargo question keeps Top-15 vessels and a natural answer passes grounding', () => {
  const result = retrieve({ ...kaohsiungFixture(), query: KAOHSIUNG_Q });
  assert.equal(result.intent.area.radius_nm, 10);
  assert.equal(result.intent.area.radius_km, 18.52);
  assert.equal(result.matched_total.vessels, 20);
  assert.equal(result.vessels.length, 15);
  assert.deepEqual([result.events.length, result.speeds.length], [0, 0]);
  const p = buildPrompt(result, KAOHSIUNG_Q);
  assert.ok(p.token_upper_bound <= 3600);
  assert.equal(p.context.vessels.length, 15, 'Top-15 must not be popped down');
  assert.ok(!p.text.includes('allowed_sentences'));
  assert.deepEqual(p.context.intent.area, {
    name: '高雄港',
    radius_km: 18.52,
    radius_nm: 10,
  });
  assert.deepEqual(p.context.intent.vessel_categories, ['cargo']);
  const brief = deterministicBrief(p.context);
  assert.match(brief, /高雄港，半徑 10 海浬（18.52 公里）/);
  assert.match(brief, /篩選船型：貨輪/);
  assert.match(brief, /全台船舶資料共 22 艘，符合條件 20 艘/);
  assert.equal(
    brief.split('\n').filter((l) => /^\d+\. 船名/.test(l)).length,
    10,
  );
  assert.match(
    brief,
    /1\. 船名「高雄貨輪0號」，MMSI 416100000，航速 0 節，距離 0 公里/,
  );
  assert.equal(validateGrounding(brief, p), true);
  const natural =
    '高雄港 10 海浬（18.52 公里）內共有 20 艘貨輪，全台共 22 艘。\n' +
    '1. 船名「高雄貨輪0號」，MMSI 416100000，航速 0 節，距離 0 公里\n' +
    '2. 船名「高雄貨輪1號」，MMSI 416100001，航速 8.5 節，距離 0.6 公里';
  assert.equal(validateGrounding(natural, p), true);
  assert.equal(
    validateGrounding(
      '共 20 艘貨輪。\n*   **船名:** 高雄貨輪0號, **MMSI:** 416100000，距離 0 公里',
      p,
    ),
    true,
    'markdown + ASCII comma is still grounded',
  );
  assert.equal(
    validateGrounding(
      '共 20 艘貨輪。\n*   **船名:** 幽靈號, **MMSI:** 416100000',
      p,
    ),
    false,
  );
  assert.equal(
    validateGrounding(
      '符合條件共 20 艘，以下列出前 15 艘：\n1. 船名「高雄貨輪0號」，MMSI 416100000。',
      p,
    ),
    true,
  );
  for (const bad of [
    '高雄港 10 海浬內共有 37 艘貨輪。',
    '船名「高雄貨輪0號」，MMSI 416100777。',
    '船名「幽靈號」，MMSI 416100000。',
    '高雄港 10 海浬內共有 20 艘貨輪，航速 31.7 節。',
    '高雄港 10 海浬內共有 15 艘貨輪。', // Top-15 length is not the matched total (20)
    '高雄港附近沒有船。',
    '高雄港附近 0 艘貨輪。',
  ])
    assert.equal(validateGrounding(bad, p), false, bad);
});
test('source_error on either source rejects zero/absence claims in free-form answers', () => {
  const result = retrieve({
    query: KAOHSIUNG_Q,
    vessels: { rows: [], data_health: { status: 'source_error', ageMs: null } },
    traffic: { events: [], speeds: [], data_health: good },
  });
  const p = buildPrompt(result, KAOHSIUNG_Q);
  for (const bad of [
    '目前沒有船。',
    '高雄港附近零艘貨輪。',
    '附近無事故。',
    '0 件事故',
  ])
    assert.equal(validateGrounding(bad, p), false, bad);
  assert.equal(validateGrounding('船舶來源異常，無法確認現況。', p), true);
});
test('model selection checks exact name before approved aliases', () => {
  assert.equal(resolveModel(['gemma4:e4b-mlx']), 'gemma4:e4b-mlx');
  assert.equal(resolveModel(['gemma4:e4b-it-qat']), 'gemma4:e4b-it-qat');
  assert.equal(resolveModel(['gemma4:e4b', 'gemma4:e4b-mlx']), 'gemma4:e4b');
  assert.equal(resolveModel(['other']), null);
  assert.equal(resolveModel(['gemma4:e4b-mlx'], 'other'), null);
});
function mockOllama(content, observe = () => {}) {
  return async (url, options) => {
    observe(url, options);
    if (url.endsWith('/api/tags'))
      return Response.json({ models: [{ name: 'gemma4:e4b-mlx' }] });
    const data =
      JSON.stringify({
        message: { content: content.slice(0, 5), thinking: 'private' },
      }) +
      '\n' +
      JSON.stringify({ message: { content: content.slice(5) }, done: true }) +
      '\n';
    const encoded = new TextEncoder().encode(data);
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoded.slice(0, 11));
          controller.enqueue(encoded.slice(11));
          controller.close();
        },
      }),
    );
  };
}
test('NDJSON buffers partial lines and defaults think:false; blank/hallucination/offline fallback', async () => {
  const p = promptFixture();
  let body;
  const valid = await runOllama(p, {
    fetchImpl: mockOllama(deterministicBrief(p.context), (url, o) => {
      if (url.endsWith('/api/chat')) body = JSON.parse(o.body);
    }),
  });
  assert.equal(valid.fallback_used, false);
  assert.equal(body.think, false);
  assert.equal(body.model, 'gemma4:e4b-mlx');
  for (const text of ['', '虛構 MMSI 999999999'])
    assert.equal(
      (await runOllama(p, { fetchImpl: mockOllama(text), think: true }))
        .fallback_used,
      true,
    );
  assert.equal(
    (
      await runOllama(p, {
        fetchImpl: async () => {
          throw new Error('offline');
        },
      })
    ).fallback_used,
    true,
  );
  assert.equal(inferenceBusy(), false);
});
test('inference concurrency lock rejects second request and client abort releases lock', async () => {
  const p = promptFixture(),
    controller = new AbortController();
  let started;
  const waiting = new Promise((resolve) => {
    started = resolve;
  });
  const first = runOllama(p, {
    signal: controller.signal,
    fetchImpl: (_url, o) =>
      new Promise((resolve, reject) => {
        started();
        o.signal.addEventListener('abort', () => reject(o.signal.reason), {
          once: true,
        });
      }),
  });
  await waiting;
  assert.equal(inferenceBusy(), true);
  await assert.rejects(runOllama(p), { statusCode: 429 });
  controller.abort(new Error('disconnect'));
  await assert.rejects(first, /disconnect/);
  assert.equal(inferenceBusy(), false);
});
test('PAT stores SHA-256 only, permissions 0600, constant time verification, rotation/revoke', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-pat-'));
  const file = path.join(dir, 'token.json');
  try {
    const store = createTokenStore(file, { root: dir }),
      first = store.rotate();
    assert.match(first.token, /^[a-f0-9]{64}$/);
    assert.equal(store.verify(first.token), true);
    assert.equal(store.verify('bad'), false);
    const raw = fs.readFileSync(file, 'utf8');
    assert.ok(!raw.includes(first.token));
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.deepEqual(Object.keys(JSON.parse(raw)), ['sha256']);
    assert.ok(!JSON.stringify(store.status()).includes(first.token));
    const second = store.rotate();
    assert.equal(store.verify(first.token), false);
    assert.equal(store.verify(second.token), true);
    fs.chmodSync(file, 0o644);
    assert.equal(store.verify(second.token), false);
    fs.chmodSync(file, 0o600);
    store.revoke();
    assert.equal(store.verify(second.token), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('PAT store refuses a symlinked parent directory (GEV-C-003)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-root-'));
  const real = path.join(root, 'real-elsewhere');
  fs.mkdirSync(real, { recursive: true });
  try {
    const linked = path.join(root, 'ai-advisor');
    fs.symlinkSync(real, linked);
    const file = path.join(linked, 'token.json');
    const store = createTokenStore(file, { root });
    assert.throws(() => store.rotate(), { code: 'GEV_PARENT_SYMLINK' });
    assert.equal(fs.existsSync(file), false);
    // A token written directly through the symlink (as if rotate() had no
    // guard) must still be refused on read — not just on rotate.
    fs.writeFileSync(path.join(real, 'token.json'), JSON.stringify({
      sha256: 'a'.repeat(64),
    }), { mode: 0o600 });
    assert.equal(store.status().configured, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test('PAT store works normally when the parent chain has no symlink', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-root-'));
  try {
    const file = path.join(root, 'ai-advisor', 'token.json');
    const store = createTokenStore(file, { root });
    const { token } = store.rotate();
    assert.equal(store.verify(token), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
const localReq = (extra = {}) => ({
  method: 'POST',
  socket: { remoteAddress: '127.0.0.1' },
  headers: {
    host: 'localhost:4173',
    origin: 'http://localhost:4173',
    'content-type': 'application/json',
    'sec-fetch-site': 'same-origin',
  },
  ...extra,
});
test('local gate requires trusted socket, local Host, exact Origin and JSON; refuses proxy spoofing', () => {
  assert.equal(isLocalBrowser(localReq(), {}), true);
  assert.equal(
    isLocalBrowser(localReq({ socket: { remoteAddress: '192.168.1.50' } }), {}),
    false,
  );
  for (const headers of [
    { origin: 'https://evil.test' },
    { host: 'evil.test' },
    { 'x-forwarded-for': '127.0.0.1' },
    { origin: undefined, 'sec-fetch-site': 'cross-site' },
  ])
    assert.equal(
      isLocalBrowser(
        localReq({ headers: { ...localReq().headers, ...headers } }),
        {},
      ),
      false,
    );
});
async function httpHarness(t, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-http-'));
  const store = createTokenStore(path.join(dir, 'token.json'), { root: dir });
  const source = fixtures();
  const middleware = createAdvisorMiddleware({
    env: {},
    tokenStore: store,
    vesselProvider: async () => source.vessels,
    trafficProvider: async () => source.traffic,
    client: (p) =>
      runOllama(p, { fetchImpl: mockOllama(deterministicBrief(p.context)) }),
    statusProvider: async () => ({ connected: true, ready: true }),
    ...overrides,
  });
  const server = http.createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 404;
      res.end();
    }),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const localHeaders = {
    Origin: base,
    'Sec-Fetch-Site': 'same-origin',
    'Content-Type': 'application/json',
  };
  return { base, store, localHeaders };
}
test('HTTP local browser JSON/SSE/status and PAT one-time lifecycle; external PAT cannot manage tokens', async (t) => {
  const { base, store, localHeaders } = await httpHarness(t);
  let r = await fetch(`${base}/api/taiwan-ai-advisor`, {
    method: 'POST',
    headers: localHeaders,
    body: JSON.stringify({ query: '基隆港', think: false }),
  });
  assert.equal(r.status, 200);
  const payload = await r.json();
  assert.equal(payload.fallback_used, false);
  assert.ok(payload.context_token_upper_bound <= 3600);
  assert.ok(Array.isArray(payload.citations.vessels));
  r = await fetch(`${base}/api/taiwan-ai-advisor`, {
    method: 'POST',
    headers: localHeaders,
    body: JSON.stringify({ query: '基隆港', stream: true }),
  });
  assert.match(r.headers.get('content-type'), /text\/event-stream/);
  assert.match(await r.text(), /event: result[\s\S]*event: done/);
  r = await fetch(`${base}/api/taiwan-ai-token`, {
    method: 'POST',
    headers: localHeaders,
    body: '{}',
  });
  const created = await r.json();
  assert.ok(created.token);
  r = await fetch(`${base}/api/taiwan-ai-token`, { headers: localHeaders });
  assert.ok(!(await r.json()).token);
  r = await fetch(`${base}/api/taiwan-ai-status`);
  assert.equal(r.status, 401);
  r = await fetch(`${base}/api/taiwan-ai-status`, {
    headers: { Authorization: `Bearer ${created.token}` },
  });
  assert.equal(r.status, 200);
  r = await fetch(`${base}/api/taiwan-ai-token`, {
    headers: { Authorization: `Bearer ${created.token}` },
  });
  assert.equal(r.status, 403);
  r = await fetch(`${base}/api/taiwan-ai-status`, {
    headers: {
      Authorization: `Bearer ${created.token}`,
      Origin: 'https://evil.test',
    },
  });
  assert.equal(r.status, 403);
  r = await fetch(`${base}/api/taiwan-ai-token`, {
    method: 'DELETE',
    headers: localHeaders,
  });
  assert.equal(r.status, 200);
  assert.equal(store.verify(created.token), false);
});
test('HTTP methods, invalid query/JSON and body limits are enforced', async (t) => {
  const { base, localHeaders } = await httpHarness(t);
  for (const [body, code] of [
    ['{', 400],
    ['{}', 400],
    ['null', 400],
    ['[]', 400],
    [JSON.stringify({ query: 'ok', think: 'true' }), 400],
    ['x'.repeat(17000), 413],
  ]) {
    const r = await fetch(`${base}/api/taiwan-ai-advisor`, {
      method: 'POST',
      headers: localHeaders,
      body,
    });
    assert.equal(r.status, code);
  }
  const r = await fetch(`${base}/api/taiwan-ai-advisor`, {
    headers: localHeaders,
  });
  assert.equal(r.status, 405);
});
test('response close aborts upstream inference', async (t) => {
  let started, aborted;
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  const cancelled = new Promise((resolve) => {
    aborted = resolve;
  });
  const { base, localHeaders } = await httpHarness(t, {
    client: (_p, { signal }) =>
      new Promise((resolve, reject) => {
        started();
        signal.addEventListener(
          'abort',
          () => {
            aborted();
            reject(signal.reason);
          },
          { once: true },
        );
      }),
  });
  const controller = new AbortController();
  const request = fetch(`${base}/api/taiwan-ai-advisor`, {
    method: 'POST',
    headers: localHeaders,
    body: JSON.stringify({ query: '基隆港' }),
    signal: controller.signal,
  });
  await entered;
  controller.abort();
  await assert.rejects(request);
  await cancelled;
});
test('AIS provider source failure, successful empty data and stale cache preserve their meanings', async () => {
  const originalGet = https.get,
    originalNow = Date.now;
  let now = 1_000_000,
    fail = true,
    rows = [];
  Date.now = () => now;
  https.get = (_url, _options, callback) => {
    const req = new EventEmitter();
    process.nextTick(() => {
      if (fail) {
        req.emit('error', new Error('source failed'));
        return;
      }
      const res = Readable.from([
        Buffer.from(JSON.stringify({ features: rows })),
      ]);
      res.statusCode = 200;
      callback(res);
    });
    return req;
  };
  try {
    const { getTaiwanVessels } = await import(
      `../vessels/mpb-taiwan.js?test=${now}`
    );
    assert.equal((await getTaiwanVessels()).data_health.status, 'source_error');
    fail = false;
    const empty = await getTaiwanVessels();
    assert.equal(empty.rows.length, 0);
    assert.equal(empty.data_health.status, 'ok');
    now += 41000;
    rows = [
      {
        geometry: { coordinates: [121.7, 25.1] },
        properties: { MMSI: '416000001', SOG: 102.3, ShipName: '真實船' },
      },
    ];
    const fresh = await getTaiwanVessels();
    assert.equal(fresh.rows[0].speed, null);
    now += 41000;
    fail = true;
    const stale = await getTaiwanVessels();
    assert.equal(stale.data_health.status, 'stale');
    assert.equal(stale.data_health.ageMs, 41000);
    assert.equal(stale.rows.length, 1);
  } finally {
    https.get = originalGet;
    Date.now = originalNow;
  }
});
test('traffic provider exposes partial failure and stale data; missing speed stays null', async () => {
  const originalFetch = globalThis.fetch,
    originalNow = Date.now;
  let now = 2_000_000,
    failEvents = true,
    failAll = true;
  Date.now = () => now;
  globalThis.fetch = async (url) => {
    if (failAll || (failEvents && url.endsWith('LiveEvents.xml')))
      throw new Error('source failed');
    const fixture = url.endsWith('SectionShape.xml')
      ? '<SectionShape><SectionID>1</SectionID><Geometry>LINESTRING(121 25, 122 25)</Geometry></SectionShape>'
      : url.endsWith('Section.xml')
        ? '<Section><SectionID>1</SectionID><RoadName>國道一號</RoadName></Section>'
        : url.endsWith('LiveTraffic.xml')
          ? '<LiveTrafficList><LiveTraffic><SectionID>1</SectionID></LiveTraffic></LiveTrafficList>'
          : url.endsWith('LiveEvents.xml')
            ? '<LiveEventList></LiveEventList>'
            : '[]';
    return new Response(fixture);
  };
  try {
    const { getTaiwanTraffic } = await import(
      `../traffic/taiwan-traffic.js?test=${now}`
    );
    assert.equal((await getTaiwanTraffic()).data_health.status, 'source_error');
    failAll = false;
    const partial = await getTaiwanTraffic();
    assert.equal(partial.data_health.status, 'source_error');
    assert.equal(partial.source_health.events.status, 'source_error');
    assert.equal(partial.speeds[0].speedKmh, null);
    now += 61000;
    failAll = true;
    const agedPartial = await getTaiwanTraffic();
    assert.equal(agedPartial.data_health.status, 'source_error');
    assert.equal(agedPartial.source_health.speeds.status, 'stale');
    failAll = false;
    failEvents = false;
    assert.equal((await getTaiwanTraffic()).data_health.status, 'ok');
    now += 61000;
    failAll = true;
    const stale = await getTaiwanTraffic();
    assert.equal(stale.data_health.status, 'stale');
    assert.equal(stale.data_health.ageMs, 61000);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test('direct ship-name mentions resolve against source names without inventing telemetry', () => {
  assert.equal(
    retrieve({ ...fixtures(), query: 'REAL SHIP 0 現況' }).matched_total
      .vessels,
    1,
  );
});
test('malformed 200 XML cannot become a healthy zero-event feed', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html>upstream error</html>');
  try {
    const { getTaiwanTraffic } =
      await import('../traffic/taiwan-traffic.js?malformed');
    assert.equal((await getTaiwanTraffic()).data_health.status, 'source_error');
  } finally {
    globalThis.fetch = original;
  }
});
test('truncated NDJSON falls back and explicit think:true is forwarded', async () => {
  let thinking;
  const p = promptFixture();
  await runOllama(p, {
    think: true,
    fetchImpl: mockOllama('', (url, opts) => {
      if (url.endsWith('/api/chat')) thinking = JSON.parse(opts.body).think;
    }),
  });
  assert.equal(thinking, true);
  const result = await runOllama(p, {
    fetchImpl: async (url) =>
      url.endsWith('/api/tags')
        ? Response.json({ models: [{ name: 'gemma4:e4b' }] })
        : new Response('{"message":{"content":"incomplete"}}\n'),
  });
  assert.equal(result.fallback_used, true);
});
test('vessel speed written as km/h or 公里 is rejected; 節 passes', () => {
  const p = buildPrompt(
    retrieve({ ...kaohsiungFixture(), query: KAOHSIUNG_Q }),
    KAOHSIUNG_Q,
  );
  const line = (speed) =>
    `共 20 艘貨輪。\n1. 船名「高雄貨輪1號」，MMSI 416100001，航速 ${speed}，距離 0.6 公里`;
  assert.equal(validateGrounding(line('8.5 節'), p), true);
  for (const bad of ['8.5 km/h', '8.5 kmh', '8.5公里', '8.5 KM/H'])
    assert.equal(validateGrounding(line(bad), p), false, bad);
  assert.equal(
    validateGrounding('共 20 艘貨輪。\n- **航速：** 8.5 km/h', p),
    false,
    'markdown bold between 航速 and number',
  );
});
test('done_reason length (token exhausted) falls back to the full deterministic brief', async () => {
  const p = buildPrompt(
    retrieve({ ...kaohsiungFixture(), query: KAOHSIUNG_Q }),
    KAOHSIUNG_Q,
  );
  const answer = '高雄港 10 海浬內共有 20 艘貨輪。\n* **船';
  const mock = (reason) => async (url) =>
    url.endsWith('/api/tags')
      ? Response.json({ models: [{ name: 'gemma4:e4b' }] })
      : new Response(
          JSON.stringify({
            message: { content: answer },
            done: true,
            done_reason: reason,
          }) + '\n',
        );
  const cut = await runOllama(p, { fetchImpl: mock('length') });
  assert.equal(cut.fallback_used, true);
  assert.equal(cut.reason, 'grounding_failed');
  assert.equal(cut.content, deterministicBrief(p.context));
  const ok = await runOllama(p, { fetchImpl: mock('stop') });
  assert.equal(ok.fallback_used, false);
});
test('num_predict is 1024 for think:false and 2048 for think:true', async () => {
  const p = promptFixture();
  const seen = {};
  for (const think of [false, true])
    await runOllama(p, {
      think,
      fetchImpl: mockOllama('', (url, o) => {
        if (url.endsWith('/api/chat'))
          seen[think] = JSON.parse(o.body).options.num_predict;
      }),
    });
  assert.deepEqual(seen, { false: 1024, true: 2048 });
});
test('natural top-5 vessel list with knots passes grounding', () => {
  const p = buildPrompt(
    retrieve({ ...kaohsiungFixture(), query: KAOHSIUNG_Q }),
    KAOHSIUNG_Q,
  );
  const rows = p.context.vessels
    .slice(0, 5)
    .map(
      (v, i) =>
        `${i + 1}. 船名「${v.name}」，MMSI ${v.mmsi}，航速 ${v.speed} 節，距離 ${v.distance_km} 公里`,
    );
  const text = `高雄港 10 海浬內共有 20 艘貨輪，以下列出前 5 艘代表性船舶：\n${rows.join('\n')}`;
  assert.equal(validateGrounding(text, p), true);
  assert.equal(validateGrounding('代表性 5 艘貨輪如下', p), true);
});
test('vessel count 5 is rejected when the context holds only 2 vessels (GEV-F-001)', () => {
  const q = '基隆港 貨輪 >15kt';
  const fx = fixtures();
  fx.vessels.rows = [vessel(), vessel(1)];
  const p = buildPrompt(retrieve({ ...fx, query: q }), q);
  assert.equal(p.context.vessels.length, 2);
  assert.equal(p.context.summary.total_vessels, 2);
  assert.equal(validateGrounding('目前共有 2 艘。', p), true);
  assert.equal(validateGrounding('目前共有 3 艘。', p), false);
  assert.equal(validateGrounding('目前共有 5 艘。', p), false);
});
