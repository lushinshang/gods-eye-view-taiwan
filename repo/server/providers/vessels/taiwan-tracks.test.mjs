import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createTaiwanTrackStore,
  taiwanTrackStats,
  taiwanTracksProxy,
} from './taiwan-tracks.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BASE = Date.parse('2026-11-04T12:00:00Z');
const vessel = (t = BASE, extra = {}) => ({
  mmsi: '416460000',
  recordEpochMs: t,
  lat: 25,
  lon: 121,
  speed: 8,
  course: 90,
  categoryKey: 'cargo',
  name: 'TEST',
  ...extra,
});
const point = (t = BASE, extra = {}) => ({
  mmsi: '416460000',
  t,
  lat: 25,
  lon: 121,
  s: 8,
  c: 90,
  k: 'cargo',
  n: 'TEST',
  ...extra,
});

async function fixture(t, clock = BASE) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'taiwan-tracks-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dir = path.join(root, 'tracks');
  const options = { dir, now: () => clock };
  return {
    root,
    dir,
    options,
    store: createTaiwanTrackStore(options),
    setNow: (v) => {
      clock = v;
    },
  };
}

test('delta recording requires newer source time and distance >=30m or interval >=10min', async (t) => {
  const { store, dir } = await fixture(t, BASE + HOUR);
  assert.equal((await store.record([vessel()])).written, 1);
  for (const row of [
    vessel(),
    vessel(BASE - 1, { lat: 26 }),
    vessel(BASE + 60_000, { lat: 25.0001 }),
  ]) {
    assert.equal((await store.record([row])).written, 0);
  }
  assert.equal(
    (await store.record([vessel(BASE + 120_000, { lat: 25.0003 })])).written,
    1,
  );
  assert.equal(
    (await store.record([vessel(BASE + 720_000, { lat: 25.0003 })])).written,
    1,
  );
  const stored = (
    await fs.readFile(path.join(dir, '2026-11-04.ndjson'), 'utf8')
  )
    .trim()
    .split('\n')
    .map(JSON.parse);
  assert.equal(stored.length, 3);
  assert.deepEqual(Object.keys(stored[0]), [
    'mmsi',
    't',
    'lat',
    'lon',
    's',
    'c',
    'k',
    'n',
  ]);
  assert.equal((await store.summary()).points, 3);
});

test('moored vessels (<0.5kn) need >=150m or >=30min; unknown speed keeps underway thresholds', async (t) => {
  const { store } = await fixture(t, BASE + 2 * HOUR);
  const moored = (dt, extra = {}) =>
    vessel(BASE + dt, { speed: 0.1, ...extra });
  assert.equal((await store.record([moored(0)])).written, 1);
  // ~33 m drift after 2 minutes and ~67 m after 20 minutes: dropped
  assert.equal(
    (await store.record([moored(120_000, { lat: 25.0003 })])).written,
    0,
  );
  assert.equal(
    (await store.record([moored(1_200_000, { lat: 25.0006 })])).written,
    0,
  );
  // ~167 m: written
  assert.equal(
    (await store.record([moored(1_300_000, { lat: 25.0015 })])).written,
    1,
  );
  // >= 30 min with no movement: written
  assert.equal(
    (await store.record([moored(1_300_000 + 1_800_000, { lat: 25.0015 })]))
      .written,
    1,
  );
  // unknown speed (null) is not treated as moored: 33 m is enough
  assert.equal(
    (
      await store.record([
        vessel(BASE + 3_200_000, { speed: null, lat: 25.0019 }),
      ])
    ).written,
    1,
  );
});

test('concurrent batches serialize deduplication; disk has five-decimal coordinates and private permissions', async (t) => {
  const { store, dir } = await fixture(t);
  const row = vessel(BASE, { lat: 25.12345678, lon: 121.12345678 });
  const results = await Promise.all([
    store.record([row]),
    store.record([row]),
    store.record([row]),
  ]);
  assert.equal(
    results.reduce((s, r) => s + r.written, 0),
    1,
  );
  const file = path.join(dir, '2026-11-04.ndjson');
  const p = JSON.parse((await fs.readFile(file, 'utf8')).trim());
  assert.equal(p.lat, 25.12346);
  assert.equal(p.lon, 121.12346);
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(dir)).mode & 0o777, 0o700);
});

test('invalid MMSI, missing record time and coordinates are skipped', async (t) => {
  const { store } = await fixture(t);
  const invalid = ['', '12345678', '1234567890', '41646000A', ' 416460000'];
  const rows = invalid.map((mmsi) => vessel(BASE, { mmsi }));
  rows.push(
    vessel(BASE, { recordEpochMs: null }),
    vessel(BASE, { lat: NaN }),
    vessel(BASE, { lat: 91 }),
  );
  assert.equal((await store.record(rows)).written, 0);
  const s = await store.summary();
  assert.equal(s.skippedInvalidMmsi, invalid.length);
  assert.equal(s.points, 0);
});

test('restart loads today and yesterday, skips corrupt lines and preserves deduplication', async (t) => {
  const { store, dir, options } = await fixture(t, BASE);
  await store.record([vessel(BASE - 20 * HOUR), vessel(BASE)]);
  await fs.appendFile(path.join(dir, '2026-11-04.ndjson'), 'not-json\n{}\n');
  const restarted = createTaiwanTrackStore(options);
  assert.equal((await restarted.getTrack('416460000')).points.length, 2);
  assert.equal((await restarted.record([vessel()])).written, 0);
  assert.equal((await restarted.summary()).corruptLines, 2);
  assert.equal(
    (await restarted.summary()).corruptLines,
    2,
    'repeated summary does not recount bad lines',
  );
});

test('UTC+8 midnight partitions by source timestamp, not fetch timestamp', async (t) => {
  const before = Date.parse('2026-11-04T15:59:00Z');
  const after = Date.parse('2026-11-04T16:00:00Z');
  const { store, dir } = await fixture(t, after);
  await store.record([vessel(before), vessel(after, { lat: 25.001 })]);
  assert.deepEqual(await fs.readdir(dir), [
    '2026-11-04.ndjson',
    '2026-11-05.ndjson',
  ]);
});

test('cleanup uses filename age, retains the cutoff date, and never touches unrelated names', async (t) => {
  const { store, dir } = await fixture(t);
  await store.summary();
  for (const file of [
    '2026-10-27.ndjson',
    '2026-10-28.ndjson',
    '2026-10-01.ndjson.bak',
    'notes.txt',
  ])
    await fs.writeFile(path.join(dir, file), '');
  // A copied old file has a fresh mtime; a retained file may have an old mtime.
  await fs.utimes(
    path.join(dir, '2026-10-28.ndjson'),
    new Date(0),
    new Date(0),
  );
  await store.record([vessel()]);
  assert.deepEqual((await fs.readdir(dir)).sort(), [
    '2026-10-01.ndjson.bak',
    '2026-10-28.ndjson',
    '2026-11-04.ndjson',
    'notes.txt',
  ]);
});

test('memory index is capped at 360 points and expires after 24 hours while disk keeps history', async (t) => {
  const { store, setNow } = await fixture(t, BASE + 400 * 60_000);
  const rows = Array.from({ length: 401 }, (_, i) =>
    vessel(BASE + i * 60_000, { lat: 25 + i * 0.0003 }),
  );
  assert.equal((await store.record(rows)).written, 401);
  const track = await store.getTrack('416460000');
  assert.equal(track.points.length, 360);
  assert.equal(track.points[0].t, BASE + 41 * 60_000);
  assert.equal((await store.getTrack('416460000', 168)).points.length, 401);
  setNow(BASE + 2 * DAY);
  assert.equal((await store.getTrack('416460000')).points.length, 0);
  assert.equal((await store.getTrack('416460000', 168)).points.length, 401);
});

test('statistics handle empty tracks, closed loops, unknown SOG and >100kn jump segments', () => {
  assert.deepEqual(taiwanTrackStats([]), {
    count: 0,
    distanceKm: 0,
    avgSpeedKn: null,
    maxSpeedKn: null,
    spanMs: 0,
    netDisplacementKm: 0,
    straightness: 0,
    loiter: false,
  });
  const loop = [
    point(BASE),
    point(BASE + HOUR, { lon: 121.02, s: 12 }),
    point(BASE + 2 * HOUR, { lat: 25.02, lon: 121.02, s: null }),
    point(BASE + 3 * HOUR, { lat: 25.02, s: 0 }),
    point(BASE + 4 * HOUR, { s: 4 }),
  ];
  const s = taiwanTrackStats(loop);
  assert.equal(s.count, 5);
  assert.ok(s.distanceKm > 8 && s.distanceKm < 9);
  assert.equal(s.avgSpeedKn, 6);
  assert.equal(s.maxSpeedKn, 12);
  assert.equal(s.netDisplacementKm, 0);
  assert.equal(s.straightness, 0);
  assert.equal(s.loiter, true);
  const straight = taiwanTrackStats([
    point(BASE),
    point(BASE + HOUR, { lon: 121.02 }),
  ]);
  assert.equal(straight.straightness, 1);
  assert.equal(straight.loiter, false);
  const jump = taiwanTrackStats([
    point(BASE),
    point(BASE + 1000, { lat: 45 }),
    point(BASE + 2000),
  ]);
  assert.equal(jump.distanceKm, 0);
  assert.equal(jump.loiter, false);
});

test('write failures warn and resolve without leaking rejections into live feed', async (t) => {
  const { root } = await fixture(t);
  const file = path.join(root, 'not-a-directory');
  await fs.writeFile(file, '');
  const store = createTaiwanTrackStore({ dir: file });
  const result = await store.record([vessel()]);
  assert.equal(result.written, 0);
  assert.match(result.error, /EEXIST/);
});

function handler(store, preview = false) {
  let middleware;
  const plugin = taiwanTracksProxy({ store });
  plugin[preview ? 'configurePreviewServer' : 'configureServer']({
    middlewares: {
      use(route, fn) {
        assert.equal(route, '/api/taiwan-vessel-tracks');
        middleware = fn;
      },
    },
  });
  return async (query, method = 'GET', pathname = '/') => {
    const headers = {};
    const res = {
      setHeader(k, v) {
        headers[k] = v;
      },
      end(body) {
        this.body = JSON.parse(body);
      },
    };
    let next = false;
    await middleware({ url: pathname + query, method }, res, () => {
      next = true;
    });
    return { status: res.statusCode, body: res.body, headers, next };
  };
}

test('API serves real single-vessel data, summary and ISO/epoch time-range queries in dev and preview', async (t) => {
  const { store } = await fixture(t, BASE + HOUR);
  await store.record([
    vessel(BASE - DAY),
    vessel(BASE),
    vessel(BASE + HOUR),
    vessel(BASE, { mmsi: '416460001', name: 'OTHER' }),
  ]);
  for (const preview of [false, true]) {
    const request = handler(store, preview);
    const r = await request('?mmsi=416460000');
    assert.equal(r.status, 200);
    assert.equal(r.body.mmsi, '416460000');
    assert.equal(r.body.name, 'TEST');
    assert.equal(r.body.hours, 24);
    assert.equal(r.body.stats.count, 2);
    assert.equal(r.body.points.length, 2);
    assert.deepEqual(Object.keys(r.body.points[0]), [
      't',
      'lat',
      'lon',
      's',
      'c',
    ]);
    assert.equal(r.headers['Cache-Control'], 'no-store');
    assert.equal(r.headers['Content-Type'], 'application/json; charset=utf-8');
    assert.equal((await request('?mmsi=999999999')).body.points.length, 0);
    assert.equal((await request('?mmsi=416460000&hours=999')).body.hours, 168);
    assert.equal((await request('?mmsi=416460000&hours=0.5')).body.hours, 1);
    const summary = (await request('?mode=summary')).body;
    assert.equal(summary.vessels, 2);
    assert.equal(summary.points, 4);
    assert.equal(summary.retentionDays, 7);
    assert.equal(summary.files, 2);
    assert.ok(summary.diskKB > 0);
    const range = await request(
      `?since=${BASE - DAY}&until=${BASE + HOUR}&limit=1`,
    );
    assert.equal(range.status, 200);
    assert.deepEqual(range.body, [
      {
        mmsi: '416460000',
        name: 'TEST',
        k: 'cargo',
        count: 3,
        firstT: BASE - DAY,
        lastT: BASE + HOUR,
      },
    ]);
    const iso = await request(
      `?since=${encodeURIComponent(new Date(BASE).toISOString())}&until=${encodeURIComponent(new Date(BASE + HOUR).toISOString())}`,
    );
    assert.equal(iso.status, 200);
    assert.equal(iso.body.length, 2);
    assert.equal(iso.body[0].count, 2);
  }
});

test('API validates parameters, rejects non-GET methods and passes unrelated routes onward', async (t) => {
  const { store } = await fixture(t);
  const request = handler(store);
  const invalid = [
    '?mmsi=abc',
    '?mmsi=41646000',
    '?mmsi=416460000&hours=abc',
    '?mmsi=416460000&hours=-1',
    '?mmsi=416460000&hours=0',
    '?mmsi=416460000&hours=',
    '?mmsi=416460000&hours=Infinity',
    '?mode=other',
    '',
    '?since=no&until=no',
    `?since=${BASE}`,
    `?since=${BASE}&until=${BASE - 1}`,
    `?since=${BASE}&until=${BASE + 8 * DAY}`,
    `?since=${BASE}&until=${BASE}&limit=0`,
    `?since=${BASE}&until=${BASE}&limit=1.5`,
    `?since=${BASE}&until=${BASE}&limit=`,
    '?since=2026-02-30T00:00:00Z&until=2026-03-03T00:00:00Z',
  ];
  for (const query of invalid)
    assert.equal((await request(query)).status, 400, query);
  const post = await request('?mode=summary', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.Allow, 'GET');
  assert.equal((await request('', 'GET', '/extra')).next, true);
});

test('disk track queries thin evenly to 2000 endpoints while statistics use all points', async (t) => {
  const { store, dir } = await fixture(t, BASE + 6 * DAY);
  await store.summary();
  const pts = Array.from({ length: 2501 }, (_, i) => point(BASE + i * 60_000));
  const byDay = new Map();
  for (const p of pts) {
    const day = new Date(p.t + 8 * HOUR).toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(p);
  }
  for (const [day, group] of byDay)
    await fs.writeFile(
      path.join(dir, `${day}.ndjson`),
      group.map(JSON.stringify).join('\n') + '\n',
      { mode: 0o600 },
    );
  const response = await handler(store)('?mmsi=416460000&hours=168');
  assert.equal(response.status, 200);
  const r = response.body;
  assert.equal(r.thinned, true);
  assert.equal(r.stats.count, 2501);
  assert.equal(r.points.length, 2000);
  assert.equal(r.points[0].t, pts[0].t);
  assert.equal(r.points.at(-1).t, pts.at(-1).t);
  assert.ok(r.points.every((p, i) => i === 0 || p.t > r.points[i - 1].t));
});

test('range caps results at 500 and query failures produce a JSON 500', async () => {
  let requestedLimit;
  const request = handler({
    range: async (_s, _u, limit) => {
      requestedLimit = limit;
      return [];
    },
  });
  assert.equal(
    (await request(`?since=${BASE}&until=${BASE}&limit=999`)).status,
    200,
  );
  assert.equal(requestedLimit, 500);
  const failed = handler({
    summary: async () => {
      throw new Error('disk unavailable');
    },
  });
  assert.equal((await failed('?mode=summary')).status, 500);
});
