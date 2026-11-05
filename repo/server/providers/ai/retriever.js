import { MOTC_CATEGORIES } from '../vessels/mpb-taiwan.js';
import { aisSpeed } from './data-health.js';

export const AREAS = Object.freeze({
  基隆港: [25.15, 121.75, 25],
  台北港: [25.15, 121.39, 25],
  台中港: [24.29, 120.49, 25],
  安平港: [22.98, 120.16, 25],
  高雄港: [22.61, 120.28, 25],
  花蓮港: [23.99, 121.64, 25],
  蘇澳港: [24.58, 121.87, 25],
  台灣海峽: [24, 119.5, 180],
  巴士海峽: [21, 121, 150],
});
const categories = {
  cargo: /貨輪|貨船|cargo/i,
  tanker: /油輪|油船|tanker/i,
  fishing: /漁船|fishing/i,
  passenger: /客輪|客船|passenger/i,
  highspeed: /高速船|high.?speed/i,
  special_ops: /引水船|搜索船|拖駁船|special_ops/i,
  pleasure_craft: /拖船|帆船|遊艇|pleasure_craft/i,
  unspecified: /未具體|未分類|unspecified/i,
};
const cn = {
  一: '1',
  三: '3',
  五: '5',
  二: '2',
  四: '4',
  六: '6',
  八: '8',
  十: '10',
};
export function distanceKm(a, b) {
  if (![a.lat, a.lon, b.lat, b.lon].every(Number.isFinite)) return Infinity;
  const r = Math.PI / 180,
    dLat = (b.lat - a.lat) * r,
    dLon = (b.lon - a.lon) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
}
const KM_PER_NM = 1.852;
const CN_DIGITS = {
  零: 0,
  一: 1,
  二: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};
function cnToNumber(text) {
  if (/^\d/.test(text)) return Number(text);
  let total = 0,
    cur = 0;
  for (const ch of text) {
    if (ch in CN_DIGITS) cur = CN_DIGITS[ch];
    else if (ch === '十' || ch === '百') {
      total += (cur || 1) * (ch === '十' ? 10 : 100);
      cur = 0;
    }
  }
  return total + cur;
}
const MARITIME_RE =
  /海事|船|港|海浬|海里|浬|\bnmi?\b|\bmmsi\b|\bais\b|cargo|tanker/i;
const TRAFFIC_RE =
  /國道|國\s*[一二三四五六八十\d]|路況|車速|事故|車禍|施工|壅塞|塞車|回堵|交通|高速公路/;
export function parseIntent(query = '', selected = {}) {
  const q = query.replaceAll('臺', '台');
  const areaName = Object.keys(AREAS).find((name) => q.includes(name));
  const nm = q.match(
    /(\d+(?:\.\d+)?|[零一二兩三四五六七八九十百]+)\s*(?:海浬|海里|浬|nmi|nm)(?![a-z])/i,
  );
  const radiusNm = nm ? cnToNumber(nm[1]) : null;
  const km = q.match(/(?:半徑|範圍)?\s*(\d+(?:\.\d+)?)\s*(?:km|公里)/i);
  const radiusOf = (fallback) =>
    radiusNm !== null
      ? {
          radius_km: Math.round(radiusNm * KM_PER_NM * 100) / 100,
          radius_nm: radiusNm,
        }
      : { radius_km: Number(km?.[1] ?? fallback) };
  let area = areaName
    ? {
        name: areaName,
        lat: AREAS[areaName][0],
        lon: AREAS[areaName][1],
        ...radiusOf(AREAS[areaName][2]),
      }
    : null;
  const coordinates = q.match(/(?:座標|附近)\s*([\d.]+)\s*[,，]\s*([\d.]+)/);
  if (coordinates)
    area = {
      lat: Number(coordinates[1]),
      lon: Number(coordinates[2]),
      ...radiusOf(25),
    };
  const speed = (units, relation) => {
    const before = q.match(
      new RegExp(`(?:${relation})\\s*(\\d+(?:\\.\\d+)?)\\s*(?:${units})`, 'i'),
    );
    const after = q.match(
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${units})\\s*(?:${relation})`, 'i'),
    );
    return before || after ? Number((before || after)[1]) : null;
  };
  const roads = [...q.matchAll(/國(?:道)?\s*([一二三四五六八十]|\d+)/g)].map(
    (m) => cn[m[1]] ?? m[1],
  );
  const target = selected.vessel ?? selected.event ?? selected;
  const mmsi =
    q.match(/\b\d{9}\b/)?.[0] ?? (target.mmsi ? String(target.mmsi) : null);
  const ship_name =
    q
      .match(
        /(?:船名|ship\s*name)\s*[:：]?\s*[「"]?([^」"，,？?]+)[」"]?/i,
      )?.[1]
      ?.trim() ?? null;
  if (
    !area &&
    !mmsi &&
    Number.isFinite(target.lat) &&
    Number.isFinite(target.lon)
  )
    area = {
      lat: target.lat,
      lon: target.lon,
      ...radiusOf(25),
    };
  const vessel_categories = Object.keys(categories).filter((key) =>
    categories[key].test(q),
  );
  const maritime =
    MARITIME_RE.test(q) || vessel_categories.length > 0 || /\b\d{9}\b/.test(q);
  const traffic = TRAFFIC_RE.test(q) || roads.length > 0;
  return {
    area,
    focus:
      maritime && !traffic
        ? 'maritime'
        : traffic && !maritime
          ? 'traffic'
          : 'both',
    vessel_categories,
    min_speed_knots: speed('kt|knots?|節', '大於|超過|高於|>|以上'),
    max_speed_knots: speed('kt|knots?|節', '小於|低於|<|以下'),
    max_road_speed_kmh: speed(
      'km/h|kmh|公里每小時|公里／小時',
      '小於|低於|<|以下',
    ),
    mmsi,
    ship_name,
    roads,
    event_id: target.id ? String(target.id) : null,
    region: /北部|北段/.test(q)
      ? 'north'
      : /中部|中段/.test(q)
        ? 'central'
        : /南部|南段/.test(q)
          ? 'south'
          : null,
    event_types: [
      /事故|車禍/.test(q) && 'accident',
      /施工/.test(q) && 'roadwork',
      /壅塞|塞車|回堵/.test(q) && 'congestion',
    ].filter(Boolean),
  };
}
const round = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
const health = (data) =>
  ['ok', 'stale', 'source_error'].includes(data?.data_health?.status)
    ? {
        status: data.data_health.status,
        ageMs: Number.isFinite(data.data_health.ageMs)
          ? Math.max(0, data.data_health.ageMs)
          : null,
      }
    : { status: 'source_error', ageMs: null };
function roadNo(s) {
  const m = String(s ?? '').match(/國(?:道)?\s*([一二三四五六八十]|\d+)/);
  return m ? (cn[m[1]] ?? m[1]) : null;
}
/** Pure, bounded output; no I/O, clocks, model calls or mutations of snapshots. */
export function retrieve({
  query = '',
  selected = {},
  vessels = {},
  traffic = {},
} = {}) {
  const intent = parseIntent(query, selected),
    rows = vessels.rows ?? [],
    events = traffic.events ?? [],
    speeds = traffic.speeds ?? [];
  if (!intent.ship_name && !intent.mmsi) {
    const lower = query.toLowerCase();
    const named = rows.find(
      (row) =>
        typeof row.name === 'string' &&
        row.name.length > 2 &&
        lower.includes(row.name.toLowerCase()),
    );
    if (named) intent.ship_name = named.name;
  }
  const byCategory = Object.fromEntries(
    Object.keys(MOTC_CATEGORIES).map((k) => [k, 0]),
  );
  const ports = Object.fromEntries(
    Object.keys(AREAS)
      .filter((k) => k.endsWith('港'))
      .map((k) => [k, 0]),
  );
  const vesselMatches = [];
  const inArea = (row) =>
    !intent.area || distanceKm(intent.area, row) <= intent.area.radius_km;
  for (const row of rows) {
    if (row.categoryKey in byCategory) byCategory[row.categoryKey]++;
    for (const port of Object.keys(ports))
      if (distanceKm({ lat: AREAS[port][0], lon: AREAS[port][1] }, row) <= 25)
        ports[port]++;
    const speed = aisSpeed(row.speed);
    if (
      !inArea(row) ||
      (intent.mmsi && String(row.mmsi) !== intent.mmsi) ||
      (intent.ship_name &&
        !String(row.name)
          .toLowerCase()
          .includes(intent.ship_name.toLowerCase())) ||
      (intent.vessel_categories.length &&
        !intent.vessel_categories.includes(row.categoryKey)) ||
      (intent.min_speed_knots !== null &&
        (speed === null || speed <= intent.min_speed_knots)) ||
      (intent.max_speed_knots !== null &&
        (speed === null || speed >= intent.max_speed_knots))
    )
      continue;
    vesselMatches.push({
      mmsi: String(row.mmsi),
      name: row.name,
      category: row.categoryKey,
      speed,
      lat: row.lat,
      lon: row.lon,
      ...(intent.area
        ? { distance_km: round(distanceKm(intent.area, row)) }
        : {}),
      flags: speed !== null && speed > 30 ? ['high_speed'] : [],
    });
  }
  vesselMatches.sort(
    (a, b) =>
      (a.distance_km ?? 0) - (b.distance_km ?? 0) ||
      (b.speed ?? -1) - (a.speed ?? -1) ||
      a.mmsi.localeCompare(b.mmsi),
  );
  const roadFilter = (row) =>
    inArea(row) &&
    (!intent.roads.length || intent.roads.includes(roadNo(row.road))) &&
    (!intent.region ||
      (Number.isFinite(row.lat) &&
        (intent.region === 'north'
          ? row.lat >= 24.5
          : intent.region === 'central'
            ? row.lat >= 23.5 && row.lat < 24.5
            : row.lat < 23.5))) &&
    (intent.max_road_speed_kmh === null ||
      (Number.isFinite(row.speedKmh) &&
        row.speedKmh < intent.max_road_speed_kmh));
  const eventMatches = events
    .filter(
      (e) =>
        roadFilter(e) &&
        (!intent.event_id || String(e.id) === intent.event_id) &&
        (!intent.event_types.length || intent.event_types.includes(e.type)),
    )
    .map((e) => ({
      id: e.id,
      type: e.type,
      road: e.road,
      title: e.title,
      lat: e.lat,
      lon: e.lon,
      speedKmh: e.speedKmh,
      flags: e.type === 'accident' ? ['accident'] : [],
    }));
  const speedMatches = speeds
    .filter(roadFilter)
    .map((s) => ({
      id: s.id,
      road: s.road,
      name: s.name,
      speedKmh: s.speedKmh,
      lat: s.lat,
      lon: s.lon,
      flags:
        Number.isFinite(s.speedKmh) && s.speedKmh < 40
          ? ['severe_congestion']
          : [],
    }))
    .sort((a, b) => (a.speedKmh ?? Infinity) - (b.speedKmh ?? Infinity));
  const known = speeds.filter(
    (s) => Number.isFinite(s.speedKmh) && s.speedKmh >= 0,
  );
  const byRoad = {};
  for (const s of known) {
    const key = roadNo(s.road) ?? s.road ?? 'unknown';
    const entry = (byRoad[key] ??= { count: 0, sum: 0 });
    entry.count++;
    entry.sum += s.speedKmh;
  }
  return {
    intent,
    data_health: { vessels: health(vessels), traffic: health(traffic) },
    summary: {
      total_vessels: rows.length,
      by_category: byCategory,
      ports_25km: ports,
      total_events: events.length,
      events_by_type: events.reduce((a, e) => {
        a[e.type] = (a[e.type] ?? 0) + 1;
        return a;
      }, {}),
      avg_speed_kmh: known.length
        ? round(known.reduce((n, s) => n + s.speedKmh, 0) / known.length)
        : null,
      roads: Object.fromEntries(
        Object.entries(byRoad).map(([key, v]) => [
          key,
          { sections: v.count, avg_speed_kmh: round(v.sum / v.count) },
        ]),
      ),
    },
    matched_total: {
      vessels: vesselMatches.length,
      events: eventMatches.length,
      speeds: speedMatches.length,
    },
    vessels: vesselMatches.slice(0, 15),
    // maritime focus: keep matched_total honest, but don't spend context on unrelated traffic detail
    events: intent.focus === 'maritime' ? [] : eventMatches.slice(0, 15),
    speeds: intent.focus === 'maritime' ? [] : speedMatches.slice(0, 15),
    flags: [
      ...new Set(
        [...vesselMatches, ...eventMatches, ...speedMatches].flatMap(
          (r) => r.flags,
        ),
      ),
    ],
  };
}
