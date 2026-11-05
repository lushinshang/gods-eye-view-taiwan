import { dataHealth } from '../ai/data-health.js';

/**
 * Taiwan land traffic provider & proxy (`/api/taiwan-traffic`)
 *
 * Keyless sources:
 *  - 高公局 TISVCloud  LiveEvents.xml   — 國道即時事件（事故/施工/壅塞/其他）
 *  - 高公局 TISVCloud  LiveTraffic.xml  — 國道路段即時車速（60s）
 *  - 高公局 TISVCloud  Section.xml / SectionShape.xml — 路段名稱與幾何（靜態，快取 24h，
 *    對齊 Section.xml UpdateInterval=86400；過期重抓失敗時沿用舊資料）
 *  - 警廣 PBS / 內政部開放資料 (可選) — 背景非阻塞更新，失敗退避 1 小時，不影響其他來源
 *
 * 60 秒記憶體快取；上游失敗時回傳上一次成功的資料（stale）。
 */

const TISV_BASE = 'https://tisvcloud.freeway.gov.tw/history/motc20';
const PBS_URL =
  'https://od.moi.gov.tw/api/v1/rest/datastore/A01010000C-000674-015';
const CACHE_TTL_MS = 60_000;
const STATIC_TTL_MS = 24 * 60 * 60_000;
const FETCH_TIMEOUT_MS = 20_000;
const PBS_TIMEOUT_MS = 6_000;
const PBS_RETRY_AFTER_FAILURE_MS = 60 * 60_000;

export const EVENT_TYPES = Object.freeze({
  1: { type: 'accident', label: '事故', color: '#ff3b30' },
  2: { type: 'roadwork', label: '施工', color: '#ff9500' },
  3: { type: 'congestion', label: '壅塞', color: '#ffcc00' },
  4: { type: 'control', label: '管制', color: '#af52de' },
  8: { type: 'other', label: '其他異常', color: '#8e8e93' },
});
const OTHER_TYPE = EVENT_TYPES[8];

const CN_DIGITS = {
  一: '1',
  二: '2',
  三: '3',
  四: '4',
  五: '5',
  六: '6',
  八: '8',
  十: '10',
};
const DIR_MAP = { 南向: 'S', 北向: 'N', 東向: 'E', 西向: 'W' };

const decodeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** First `<tag>…</tag>` text inside a block, or null. */
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decodeXml(m[1].trim()) : null;
}

function blocks(xml, name) {
  return xml.match(new RegExp(`<${name}>[\\s\\S]*?</${name}>`, 'g')) ?? [];
}

let _fetch = (...args) => globalThis.fetch(...args);

async function fetchText(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const response = await _fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 GodsEyeView', Accept: '*/*' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return response.text();
}

/** "國道一號高架" → "1"; "國道1號" → "1"; 其他 → null. */
function roadNumber(name) {
  const m = String(name ?? '').match(/國道\s*([一二三四五六八十\d]+)/);
  if (!m) return null;
  return CN_DIGITS[m[1]] ?? m[1];
}

function speedColor(speed) {
  if (!Number.isFinite(speed)) return '#8e8e93';
  if (speed <= 40) return '#ff3b30';
  if (speed <= 70) return '#ffcc00';
  return '#34c759';
}

function midpointOfLineString(wkt) {
  const pts = [...wkt.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)];
  if (!pts.length) return null;
  const [, lon, lat] = pts[Math.floor(pts.length / 2)];
  return { lat: Number(lat), lon: Number(lon) };
}

const haversineKm = (a, b) => {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

// ── 靜態路段（Section + SectionShape），24h 快取 ─────────────────────────
let _sections = null;
let _sectionsAt = 0;
let _sectionsPromise = null;

async function loadSections() {
  if (_sections && Date.now() - _sectionsAt < STATIC_TTL_MS) return _sections;
  if (_sectionsPromise) return _sectionsPromise;
  _sectionsPromise = (async () => {
    try {
      const [sectionXml, shapeXml] = await Promise.all([
        fetchText(`${TISV_BASE}/Section.xml`),
        fetchText(`${TISV_BASE}/SectionShape.xml`),
      ]);
      const mids = new Map();
      for (const b of blocks(shapeXml, 'SectionShape')) {
        const id = tag(b, 'SectionID');
        const wkt = tag(b, 'Geometry');
        const mid = id && wkt ? midpointOfLineString(wkt) : null;
        if (mid) mids.set(id, mid);
      }
      const map = new Map();
      for (const b of blocks(sectionXml, 'Section')) {
        const id = tag(b, 'SectionID');
        const mid = mids.get(id);
        if (!id || !mid) continue;
        map.set(id, {
          id,
          name: tag(b, 'SectionName'),
          road: tag(b, 'RoadName'),
          roadNo: roadNumber(tag(b, 'RoadName')),
          direction: tag(b, 'RoadDirection'),
          speedLimit: Number(tag(b, 'SpeedLimit')) || null,
          ...mid,
        });
      }
      if (map.size) {
        _sections = map;
        _sectionsAt = Date.now();
      }
      return _sections ?? map;
    } catch (err) {
      // 過期重抓失敗：沿用記憶體舊路網，避免車速歸零
      if (_sections) return _sections;
      throw err;
    } finally {
      _sectionsPromise = null;
    }
  })();
  return _sectionsPromise;
}

// ── 即時車速 ────────────────────────────────────────────────────────────
async function loadSpeeds() {
  const [sections, xml] = await Promise.all([
    loadSections(),
    fetchText(`${TISV_BASE}/LiveTraffic.xml`),
  ]);
  if (
    !/<LiveTrafficList(?:\s|>)/.test(xml) ||
    !xml.includes('</LiveTrafficList>')
  )
    throw new Error('Invalid traffic XML');
  const speeds = [];
  for (const b of blocks(xml, 'LiveTraffic')) {
    const sec = sections.get(tag(b, 'SectionID'));
    if (!sec) continue;
    const speedText = tag(b, 'TravelSpeed');
    const raw =
      speedText === null || speedText === '' ? NaN : Number(speedText);
    const speedKmh = Number.isFinite(raw) && raw >= 0 ? raw : null;
    speeds.push({
      id: sec.id,
      name: sec.name,
      road: sec.road,
      direction: sec.direction,
      lat: sec.lat,
      lon: sec.lon,
      speedKmh,
      speedLimit: sec.speedLimit,
      congestionLevel: Number(tag(b, 'CongestionLevel')) || null,
      color: speedColor(speedKmh),
      timestamp: tag(b, 'DataCollectTime'),
    });
  }
  return { speeds, sections };
}

// ── 即時事件 ────────────────────────────────────────────────────────────
function nearestSpeed(event, speeds, sections) {
  const no = roadNumber(event.road);
  const dir = DIR_MAP[event.direction];
  let best = null;
  let bestKm = 5;
  for (const s of speeds) {
    if (s.speedKmh == null) continue;
    const sec = sections.get(s.id);
    if (!sec || sec.roadNo !== no) continue;
    if (dir && sec.direction && sec.direction !== dir) continue;
    const km = haversineKm(event, sec);
    if (km < bestKm) {
      bestKm = km;
      best = s.speedKmh;
    }
  }
  return best;
}

async function loadTisvEvents() {
  const xml = await fetchText(`${TISV_BASE}/LiveEvents.xml`);
  if (!/<LiveEventList(?:\s|>)/.test(xml) || !xml.includes('</LiveEventList>'))
    throw new Error('Invalid events XML');
  const events = [];
  for (const b of blocks(xml, 'LiveEvent')) {
    const pos = (tag(b, 'Positions') ?? '').match(
      /POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/,
    );
    if (!pos) continue;
    const meta = EVENT_TYPES[Number(tag(b, 'EventType'))] ?? OTHER_TYPE;
    events.push({
      id: tag(b, 'EventID'),
      type: meta.type,
      typeLabel: meta.label,
      title: tag(b, 'EventTitle'),
      description: tag(b, 'Description'),
      road: tag(b, 'Road'),
      direction: tag(b, 'Direction'),
      lat: Number(pos[2]),
      lon: Number(pos[1]),
      speedKmh: null,
      color: meta.color,
      timestamp: tag(b, 'PublishTime') ?? tag(b, 'EffectiveTime'),
      source: '高公局 TISVCloud',
    });
  }
  return events;
}

/** 警廣 PBS / MOI 開放資料：盡力嘗試，格式不符或失敗即回傳空陣列。 */
async function loadPbsEvents() {
  const body = JSON.parse(await fetchText(PBS_URL, PBS_TIMEOUT_MS));
  const rows =
    body?.result?.records ?? body?.records ?? (Array.isArray(body) ? body : []);
  const events = [];
  for (const r of rows) {
    const lat = Number(r.y ?? r.lat ?? r.latitude);
    const lon = Number(r.x ?? r.lon ?? r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const comment = String(r.comment ?? r.description ?? r.areaNm ?? '').trim();
    const type = /事故|車禍/.test(comment)
      ? EVENT_TYPES[1]
      : /施工|維修/.test(comment)
        ? EVENT_TYPES[2]
        : /管制|封閉/.test(comment)
          ? EVENT_TYPES[4]
          : /壅塞|塞車|回堵/.test(comment)
            ? EVENT_TYPES[3]
            : OTHER_TYPE;
    events.push({
      id: `pbs-${r.UID ?? r.id ?? events.length}`,
      type: type.type,
      typeLabel: type.label,
      title: `${type.label}事件`,
      description: comment,
      road: String(r.roadtype ?? r.road ?? r.areaNm ?? ''),
      direction: String(r.direction ?? ''),
      lat,
      lon,
      speedKmh: null,
      color: type.color,
      timestamp: r.happendate ?? r.modDttm ?? null,
      source: '警廣 PBS',
    });
  }
  return events;
}

// ── 警廣 PBS：背景非阻塞更新 + 失敗退避 ─────────────────────────────────
let _pbsEvents = [];
let _pbsFetchedAt = 0;
let _pbsRetryAfter = 0;
let _pbsPromise = null;
let _pbsError = null;

/** 不等待結果；快取 60 秒，失敗後 1 小時內不再發請求。 */
function refreshPbsInBackground() {
  const now = Date.now();
  if (_pbsPromise || now < _pbsRetryAfter) return;
  if (_pbsFetchedAt && now - _pbsFetchedAt < CACHE_TTL_MS) return;
  _pbsPromise = loadPbsEvents()
    .then((events) => {
      _pbsEvents = events;
      _pbsFetchedAt = Date.now();
      _pbsError = null;
    })
    .catch((err) => {
      _pbsEvents = [];
      _pbsError = err?.message ?? String(err);
      _pbsRetryAfter = Date.now() + PBS_RETRY_AFTER_FAILURE_MS;
    })
    .finally(() => {
      _pbsPromise = null;
    });
}

function pbsState() {
  if (_pbsError) return { status: 'source_error', label: `error: ${_pbsError}` };
  if (!_pbsFetchedAt) return { status: 'pending', label: 'pending' };
  return { status: 'ok', label: 'ok' };
}

// ── 快取與組裝 ──────────────────────────────────────────────────────────
let _cache = null;
let _cacheAt = 0;
let _inflight = null;

function buildSummary(events, speeds) {
  const byType = {};
  for (const e of events) byType[e.type] = (byType[e.type] ?? 0) + 1;
  const known = speeds.filter((s) => s.speedKmh != null);
  const avg = known.length
    ? Math.round(known.reduce((a, s) => a + s.speedKmh, 0) / known.length)
    : null;
  return {
    totalEvents: events.length,
    byType,
    sections: speeds.length,
    avgSpeedKmh: avg,
    slowSections: known.filter((s) => s.speedKmh <= 40).length,
    congestedSections: known.filter((s) => s.speedKmh > 40 && s.speedKmh <= 70)
      .length,
  };
}

async function build() {
  refreshPbsInBackground();
  const [evR, spR] = await Promise.allSettled([loadTisvEvents(), loadSpeeds()]);
  const pbs = pbsState();
  if (evR.status === 'rejected' && spR.status === 'rejected')
    throw new Error(`TISV unavailable: ${evR.reason?.message}`);
  const speedData =
    spR.status === 'fulfilled'
      ? spR.value
      : { speeds: [], sections: new Map() };
  const events = [
    ...(evR.status === 'fulfilled' ? evR.value : []),
    ...(_pbsError ? [] : _pbsEvents),
  ];
  for (const e of events) {
    if (e.source === '高公局 TISVCloud')
      e.speedKmh = nearestSpeed(e, speedData.speeds, speedData.sections);
  }
  events.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  const status = (r) =>
    r.status === 'fulfilled' ? 'ok' : `error: ${r.reason?.message}`;
  return {
    events,
    speeds: speedData.speeds,
    summary: buildSummary(events, speedData.speeds),
    sources: {
      tisvEvents: status(evR),
      tisvSpeed: status(spR),
      pbs: pbs.label,
    },
    updatedAt: new Date().toISOString(),
    stale: false,
    data_health: {
      status: [evR, spR].some((r) => r.status === 'rejected')
        ? 'source_error'
        : 'ok',
      ageMs: 0,
    },
    source_health: {
      events: {
        status: evR.status === 'fulfilled' ? 'ok' : 'source_error',
        ageMs: evR.status === 'fulfilled' ? 0 : null,
      },
      speeds: {
        status: spR.status === 'fulfilled' ? 'ok' : 'source_error',
        ageMs: spR.status === 'fulfilled' ? 0 : null,
      },
      pbs: {
        status: pbs.status,
        ageMs: pbs.status === 'ok' ? Date.now() - _pbsFetchedAt : null,
      },
    },
  };
}

function trafficSnapshot(snapshot, failed = false, error) {
  const health = dataHealth(_cacheAt, CACHE_TTL_MS, failed);
  const freshness = health.status;
  if (snapshot.data_health.status === 'source_error')
    health.status = 'source_error';
  return {
    ...snapshot,
    data_health: health,
    stale: health.status === 'stale',
    source_health: Object.fromEntries(
      Object.entries(snapshot.source_health).map(([key, value]) => [
        key,
        {
          ...value,
          status: value.status === 'ok' ? freshness : value.status,
          ageMs: value.ageMs === null ? null : health.ageMs,
        },
      ]),
    ),
    ...(error ? { error } : {}),
  };
}

/** Cached snapshot (60s). On total upstream failure, serves the last good one. */
export async function getTaiwanTraffic() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS)
    return trafficSnapshot(_cache);
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      _cache = await build();
      _cacheAt = Date.now();
      return trafficSnapshot(_cache);
    } catch (err) {
      if (_cache) return trafficSnapshot(_cache, true, err.message);
      return {
        events: [],
        speeds: [],
        data_health: { status: 'source_error', ageMs: null },
        error: err.message,
      };
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

/** 測試用：注入 fetch（傳 null 還原）並重置所有模組內快取狀態。 */
export function __resetForTest({ fetch: fetchImpl = null } = {}) {
  _fetch = fetchImpl ?? ((...args) => globalThis.fetch(...args));
  _sections = null;
  _sectionsAt = 0;
  _sectionsPromise = null;
  _pbsEvents = [];
  _pbsFetchedAt = 0;
  _pbsRetryAfter = 0;
  _pbsPromise = null;
  _pbsError = null;
  _cache = null;
  _cacheAt = 0;
  _inflight = null;
}

/** Vite plugin: mounts `/api/taiwan-traffic`. Query: `types`, `road`, `events_only`. */
export function taiwanTrafficProxy() {
  function install(middlewares) {
    middlewares.use('/api/taiwan-traffic', async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      try {
        const q = new URL(req.url || '', 'http://localhost').searchParams;
        const types = q
          .get('types')
          ?.split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const road = q.get('road');
        const snap = await getTaiwanTraffic();
        let events = snap.events;
        if (types?.length)
          events = events.filter((e) => types.includes(e.type));
        if (road) events = events.filter((e) => e.road?.includes(road));
        const eventsOnly = q.get('events_only') === '1';
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            ...snap,
            events,
            speeds: eventsOnly ? [] : snap.speeds,
            summary:
              types?.length || road
                ? buildSummary(events, snap.speeds)
                : snap.summary,
          }),
        );
      } catch (err) {
        res.statusCode = 502;
        res.end(
          JSON.stringify({
            error: err?.message || 'Taiwan traffic unavailable',
            data_health: { status: 'source_error', ageMs: null },
            events: [],
            speeds: [],
          }),
        );
      }
    });
  }
  return {
    name: 'taiwan-traffic-proxy',
    configureServer(server) {
      install(server.middlewares);
    },
    configurePreviewServer(server) {
      install(server.middlewares);
    },
  };
}
