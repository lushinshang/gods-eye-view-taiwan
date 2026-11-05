import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TAIWAN_OFFSET = 8 * HOUR;
const MMSI = /^\d{9}$/;
const TRACK_FILE = /^\d{4}-\d{2}-\d{2}\.ndjson$/;
export const MAX_POINTS_PER_VESSEL = 360;
const dayName = (t) => new Date(t + TAIWAN_OFFSET).toISOString().slice(0, 10);

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

/** AIS speed averages use available SOG readings; only distance rejects jumps. */
export function taiwanTrackStats(points) {
  let distance = 0;
  let speedSum = 0;
  let speedCount = 0;
  let maxSpeedKn = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (Number.isFinite(p.s) && p.s >= 0 && p.s < 102.3) {
      speedSum += p.s;
      speedCount++;
      maxSpeedKn = Math.max(maxSpeedKn ?? 0, p.s);
    }
    if (i === 0) continue;
    const previous = points[i - 1];
    const elapsed = p.t - previous.t;
    const km = distanceKm(previous, p);
    if (elapsed > 0 && km / (elapsed / HOUR) / 1.852 <= 100) distance += km;
  }
  const spanMs = points.length > 1 ? points.at(-1).t - points[0].t : 0;
  const netDisplacementKm =
    points.length > 1 ? distanceKm(points[0], points.at(-1)) : 0;
  const straightness = distance > 0 ? netDisplacementKm / distance : 0;
  return {
    count: points.length,
    distanceKm: distance,
    avgSpeedKn: speedCount ? speedSum / speedCount : null,
    maxSpeedKn,
    spanMs,
    netDisplacementKm,
    straightness,
    // Provisional thresholds; not calibrated against real vessel behaviour.
    loiter: spanMs >= 3 * HOUR && distance >= 2 && straightness < 0.2,
  };
}

function validPoint(p) {
  return (
    p &&
    typeof p.mmsi === 'string' &&
    MMSI.test(p.mmsi) &&
    Number.isFinite(p.t) &&
    Math.abs(p.t) <= 8.64e15 - TAIWAN_OFFSET &&
    Number.isFinite(p.lat) &&
    Math.abs(p.lat) <= 90 &&
    Number.isFinite(p.lon) &&
    Math.abs(p.lon) <= 180
  );
}

/** Single-writer append store. Initialization is lazy so imports never write disk. */
export function createTaiwanTrackStore({
  dir = path.join(process.cwd(), '.gev-cache', 'taiwan-tracks'),
  now = Date.now,
} = {}) {
  const index = new Map();
  const lastPoints = new Map();
  let skippedInvalidMmsi = 0;
  let corruptLines = 0;
  let initialized;
  let pending = Promise.resolve();

  function pruneMemory() {
    const cutoff = now() - DAY;
    for (const [mmsi, points] of index) {
      const recent = points
        .filter((p) => p.t >= cutoff)
        .slice(-MAX_POINTS_PER_VESSEL);
      if (recent.length) index.set(mmsi, recent);
      else index.delete(mmsi);
    }
    for (const [mmsi, p] of lastPoints) {
      if (p.t < now() - 7 * DAY) lastPoints.delete(mmsi);
    }
  }

  function remember(p) {
    const previous = lastPoints.get(p.mmsi);
    if (!previous || p.t > previous.t) lastPoints.set(p.mmsi, p);
    if (p.t < now() - DAY) return;
    const points = index.get(p.mmsi) || [];
    // Startup files need not be ordered by line or by timestamp.
    if (points.some((v) => v.t === p.t)) return;
    points.push(p);
    points.sort((a, b) => a.t - b.t);
    index.set(p.mmsi, points.slice(-MAX_POINTS_PER_VESSEL));
  }

  async function files() {
    return (await fs.readdir(dir)).filter((f) => TRACK_FILE.test(f)).sort();
  }

  async function* readPoints(file, countCorrupt = false) {
    const stream = createReadStream(path.join(dir, file), { encoding: 'utf8' });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        if (!line.trim()) continue;
        let p;
        try {
          p = JSON.parse(line);
        } catch {
          /* handled as corrupt below */
        }
        if (!validPoint(p)) {
          if (countCorrupt) corruptLines++;
          continue;
        }
        yield p;
      }
    } finally {
      lines.close();
      stream.destroy();
    }
  }

  function ready() {
    return (initialized ??= (async () => {
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      await fs.chmod(dir, 0o700);
      const startup = new Set([
        `${dayName(now() - DAY)}.ndjson`,
        `${dayName(now())}.ndjson`,
      ]);
      for (const file of await files()) {
        if (!startup.has(file)) continue;
        await fs.chmod(path.join(dir, file), 0o600);
        for await (const p of readPoints(file, true)) remember(p);
      }
      pruneMemory();
    })());
  }

  async function cleanup() {
    const cutoff = dayName(now() - 7 * DAY);
    for (const file of await files()) {
      if (file.slice(0, 10) < cutoff) await fs.unlink(path.join(dir, file));
    }
    pruneMemory();
  }

  function record(rows) {
    // Serialize batches so simultaneous refreshes compare against committed points.
    pending = pending
      .then(async () => {
        await ready();
        const groups = new Map();
        const staged = new Map();
        for (const row of rows) {
          const mmsi = String(row.mmsi ?? '');
          if (!MMSI.test(mmsi)) {
            skippedInvalidMmsi++;
            continue;
          }
          const p = {
            mmsi,
            t: row.recordEpochMs,
            lat: Math.round(row.lat * 1e5) / 1e5,
            lon: Math.round(row.lon * 1e5) / 1e5,
            s:
              Number.isFinite(row.speed) && row.speed >= 0 && row.speed < 102.3
                ? row.speed
                : null,
            c:
              Number.isFinite(row.course) && row.course >= 0 && row.course < 360
                ? row.course
                : null,
            k: row.categoryKey ?? null,
            n: row.name ?? '',
          };
          if (!validPoint(p)) continue;
          const previous = staged.get(mmsi) || lastPoints.get(mmsi);
          // Moored / very slow vessels drift by GPS noise: raise the thresholds.
          const slow = p.s !== null && p.s < 0.5;
          const minKm = slow ? 0.15 : 0.03;
          const minMs = slow ? 1_800_000 : 600_000;
          if (
            previous &&
            (p.t <= previous.t ||
              (p.t - previous.t < minMs && distanceKm(previous, p) < minKm))
          )
            continue;
          // Do not resurrect files that retention would delete immediately.
          if (dayName(p.t) < dayName(now() - 7 * DAY)) continue;
          const file = `${dayName(p.t)}.ndjson`;
          if (!groups.has(file)) groups.set(file, []);
          groups.get(file).push(p);
          staged.set(mmsi, p);
        }
        let written = 0;
        for (const [file, points] of groups) {
          const filename = path.join(dir, file);
          await fs.appendFile(
            filename,
            points.map((p) => JSON.stringify(p) + '\n').join(''),
            { mode: 0o600 },
          );
          await fs.chmod(filename, 0o600);
          for (const p of points) remember(p);
          written += points.length;
        }
        await cleanup();
        return { written };
      })
      .catch((err) => {
        console.warn('[Taiwan tracks] Record failed:', err.message);
        return { written: 0, error: err.message };
      });
    return pending;
  }

  async function* scan(since, until) {
    for (const file of await files()) {
      const date = file.slice(0, 10);
      if (date < dayName(since) || date > dayName(until)) continue;
      for await (const p of readPoints(file)) {
        if (p.t >= since && p.t <= until) yield p;
      }
    }
  }

  async function getTrack(mmsi, hours = 24) {
    await pending;
    await ready();
    pruneMemory();
    const until = now();
    const since = until - hours * HOUR;
    let points;
    if (hours <= 24)
      points = (index.get(mmsi) || []).filter(
        (p) => p.t >= since && p.t <= until,
      );
    else {
      points = [];
      for await (const p of scan(since, until))
        if (p.mmsi === mmsi) points.push(p);
      points.sort((a, b) => a.t - b.t);
    }
    const stats = taiwanTrackStats(points);
    const name = points.at(-1)?.n || '';
    const thinned = points.length > 2000;
    if (thinned) {
      const all = points;
      points = Array.from(
        { length: 2000 },
        (_, i) => all[Math.round((i * (all.length - 1)) / 1999)],
      );
    }
    return {
      mmsi,
      name,
      hours,
      points: points.map(({ t, lat, lon, s, c }) => ({ t, lat, lon, s, c })),
      stats,
      thinned,
    };
  }

  async function summary() {
    await pending;
    await ready();
    const retained = (await files()).filter(
      (f) => f.slice(0, 10) >= dayName(now() - 7 * DAY),
    );
    let points = 0;
    let bytes = 0;
    let oldestT = null;
    let newestT = null;
    const vessels = new Set();
    for (const file of retained) {
      bytes += (await fs.stat(path.join(dir, file))).size;
      for await (const p of readPoints(file)) {
        points++;
        vessels.add(p.mmsi);
        oldestT = Math.min(oldestT ?? p.t, p.t);
        newestT = Math.max(newestT ?? p.t, p.t);
      }
    }
    return {
      vessels: vessels.size,
      points,
      retentionDays: 7,
      oldestT,
      newestT,
      diskKB: Math.ceil(bytes / 1024),
      files: retained.length,
      skippedInvalidMmsi,
      corruptLines,
    };
  }

  async function range(since, until, limit = 100) {
    await pending;
    await ready();
    const vessels = new Map();
    for await (const p of scan(since, until)) {
      const v = vessels.get(p.mmsi) || {
        mmsi: p.mmsi,
        name: p.n,
        k: p.k,
        count: 0,
        firstT: p.t,
        lastT: p.t,
      };
      v.count++;
      v.firstT = Math.min(v.firstT, p.t);
      if (p.t >= v.lastT) {
        v.lastT = p.t;
        v.name = p.n;
        v.k = p.k;
      }
      vessels.set(p.mmsi, v);
    }
    return [...vessels.values()]
      .sort((a, b) => b.count - a.count || a.mmsi.localeCompare(b.mmsi))
      .slice(0, limit);
  }

  return { record, getTrack, summary, range };
}

export const taiwanTrackStore = createTaiwanTrackStore();

function queryTime(value) {
  if (!value?.trim()) return null;
  let t;
  if (/^\d+$/.test(value)) t = Number(value);
  else if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/i.test(
      value,
    )
  ) {
    // Date.parse alone silently normalizes dates such as February 30.
    const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    if (
      calendar.getUTCDate() !== Number(value.slice(8, 10)) ||
      Number(value.slice(11, 13)) > 23
    )
      return null;
    t = Date.parse(value);
  }
  return Number.isFinite(t) && Math.abs(t) <= 8.64e15 - TAIWAN_OFFSET
    ? t
    : null;
}

export function taiwanTracksProxy({ store = taiwanTrackStore } = {}) {
  function install(middlewares) {
    middlewares.use('/api/taiwan-vessel-tracks', async (req, res, next) => {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname !== '/' && url.pathname !== '/api/taiwan-vessel-tracks')
        return next();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      const send = (status, payload) => {
        res.statusCode = status;
        res.end(JSON.stringify(payload));
      };
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return send(405, { error: 'Method must be GET' });
      }
      const q = url.searchParams;
      try {
        if (q.has('mode')) {
          if (q.get('mode') !== 'summary')
            return send(400, { error: 'Unknown mode' });
          return send(200, await store.summary());
        }
        if (q.has('mmsi')) {
          const mmsi = q.get('mmsi');
          if (!MMSI.test(mmsi))
            return send(400, { error: 'mmsi must contain exactly 9 digits' });
          const hours =
            q.has('hours') && q.get('hours').trim()
              ? Number(q.get('hours'))
              : q.has('hours')
                ? NaN
                : 24;
          if (!Number.isFinite(hours) || hours <= 0)
            return send(400, {
              error: 'hours must be a positive finite number',
            });
          return send(
            200,
            await store.getTrack(mmsi, Math.max(1, Math.min(168, hours))),
          );
        }
        const since = queryTime(q.get('since'));
        const until = queryTime(q.get('until'));
        const limit =
          q.has('limit') && q.get('limit').trim()
            ? Number(q.get('limit'))
            : q.has('limit')
              ? NaN
              : 100;
        if (
          since === null ||
          until === null ||
          until < since ||
          until - since > 7 * DAY
        )
          return send(400, {
            error:
              'since/until must be valid ISO or epoch ms, ordered, and at most 7 days apart',
          });
        if (!Number.isInteger(limit) || limit <= 0)
          return send(400, { error: 'limit must be a positive integer' });
        return send(200, await store.range(since, until, Math.min(500, limit)));
      } catch (err) {
        console.warn('[Taiwan tracks] Query failed:', err.message);
        return send(500, { error: 'Failed to read Taiwan vessel tracks' });
      }
    });
  }
  return {
    name: 'taiwan-vessel-tracks-proxy',
    configureServer(server) {
      install(server.middlewares);
    },
    configurePreviewServer(server) {
      install(server.middlewares);
    },
  };
}
