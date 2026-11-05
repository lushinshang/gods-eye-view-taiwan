/**
 * Taiwan MOTC MPB (航港局) AIS Live Vessel Provider & Proxy
 *
 * Fetches real-time vessel telemetry around Taiwan from official radar/AIS stations:
 * https://mpbais.motcmpb.gov.tw/aismpb/tools/geojsonais.ashx
 *
 * Implements strict memory caching (40s ttl) and maps vessels to 8 official MOTC categories.
 */

import https from 'node:https';
import { dataHealth, aisSpeed } from '../ai/data-health.js';
import { taiwanTrackStore } from './taiwan-tracks.js';

const MPB_URL = 'https://mpbais.motcmpb.gov.tw/aismpb/tools/geojsonais.ashx';
const CACHE_TTL_MS = 40_000; // 40 seconds cache

let _cachedRows = [];
let _lastFetchTime = 0;
let _fetchingPromise = null;
let _sourceError = false;

/**
 * 8 Official MOTC MPB Categories
 * 依照交通部航港局「臺灣海域船舶動態資訊系統」官方分類與配色
 */
export const MOTC_CATEGORIES = Object.freeze({
  cargo: {
    id: 'cargo',
    name: '貨輪',
    enName: 'Cargo',
    color: '#39d5ff', // 亮天藍
    icon: 'cargo-ship',
  },
  tanker: {
    id: 'tanker',
    name: '油輪',
    enName: 'Tanker',
    color: '#ff4d4f', // 紅色/紅棕
    icon: 'tanker-ship',
  },
  fishing: {
    id: 'fishing',
    name: '漁船',
    enName: 'Fishing',
    color: '#1d39c4', // 深海藍
    icon: 'fishing-boat',
  },
  passenger: {
    id: 'passenger',
    name: '客輪',
    enName: 'Passenger',
    color: '#eb2f96', // 洋紅/粉紫
    icon: 'passenger-ship',
  },
  highspeed: {
    id: 'highspeed',
    name: '高速船',
    enName: 'High Speed Craft',
    color: '#faad14', // 金黃色
    icon: 'fast-craft',
  },
  special_ops: {
    id: 'special_ops',
    name: '引水船、搜索船、拖駁船等',
    enName: 'Pilot / SAR / Dredger',
    color: '#fa8c16', // 亮橘色
    icon: 'diamond-ops',
  },
  pleasure_craft: {
    id: 'pleasure_craft',
    name: '拖船、帆船、遊艇',
    enName: 'Tug / Sailing / Yacht',
    color: '#13c2c2', // 淺青/碧綠
    icon: 'sail-craft',
  },
  unspecified: {
    id: 'unspecified',
    name: '未具體說明的船舶',
    enName: 'Unspecified',
    color: '#d9d9d9', // 灰白
    icon: 'dot-other',
  },
});

export function categorizeShip(code) {
  const num = Number(code);
  if (isNaN(num) || num === 0) return MOTC_CATEGORIES.unspecified;
  if (num === 30) return MOTC_CATEGORIES.fishing;
  if (num === 31 || num === 32 || num === 36 || num === 37)
    return MOTC_CATEGORIES.pleasure_craft;
  if (num >= 40 && num <= 49) return MOTC_CATEGORIES.highspeed;
  if (
    num === 33 ||
    num === 50 ||
    num === 51 ||
    num === 52 ||
    num === 53 ||
    num === 54 ||
    num === 55 ||
    num === 58
  )
    return MOTC_CATEGORIES.special_ops;
  if (num >= 60 && num <= 69) return MOTC_CATEGORIES.passenger;
  if (num >= 70 && num <= 79) return MOTC_CATEGORIES.cargo;
  if (num >= 80 && num <= 89) return MOTC_CATEGORIES.tanker;
  return MOTC_CATEGORIES.unspecified;
}

/** Parse source wall-clock times as Taiwan time, independent of the host TZ. */
export function parseRecordTime(str) {
  if (typeof str !== 'string') return null;
  const match = str
    .trim()
    .match(
      /^(\d{4})([-/])(\d{2})\2(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})?$/i,
    );
  if (!match) return null;
  const [
    ,
    year,
    ,
    month,
    day,
    hour,
    minute,
    second,
    fraction = '',
    zone = '+08:00',
  ] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    !Number.isFinite(calendar.getTime()) ||
    calendar.getUTCDate() !== Number(day) ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  )
    return null;
  const epoch = Date.parse(
    `${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}${zone}`,
  );
  return Number.isFinite(epoch) ? epoch : null;
}

export function normalizeCourse(v) {
  return Number.isFinite(v) && v >= 0 && v < 360 ? v : null;
}

function fetchRawJson() {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        Referer: 'https://mpbais.motcmpb.gov.tw/',
        Accept: 'application/json',
      },
      timeout: 30000,
    };

    const req = https.get(MPB_URL, options, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP Status ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8');
          const json = JSON.parse(body);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });
    req.on('error', reject);
  });
}

/**
 * Fetch and convert Taiwan MOTC GeoJSON data into standardized vessel rows.
 */
export async function getTaiwanVesselRows() {
  const now = Date.now();
  if (_lastFetchTime > 0 && now - _lastFetchTime < CACHE_TTL_MS) {
    return _cachedRows;
  }

  if (_fetchingPromise) {
    return _fetchingPromise;
  }

  _fetchingPromise = (async () => {
    try {
      const geojson = await fetchRawJson();
      if (!Array.isArray(geojson?.features))
        throw new Error('Invalid AIS GeoJSON');
      const rows = convertTaiwanVesselRows(geojson, now);
      // Disk failures are caught by the store and must never fail this feed.
      void taiwanTrackStore.record(rows);

      {
        _sourceError = false;
        _cachedRows = rows;
        _lastFetchTime = Date.now();
        console.log(
          `[MPB Taiwan AIS] Successfully cached ${rows.length} Taiwan live vessels.`,
        );
      }

      return _cachedRows;
    } catch (err) {
      _sourceError = true;
      console.warn('[MPB Taiwan AIS] Fetch failed:', err.message);
      return _cachedRows;
    } finally {
      _fetchingPromise = null;
    }
  })();

  return _fetchingPromise;
}

/** Shared pure conversion for source fixtures and live fetches. */
export function convertTaiwanVesselRows(geojson, now = Date.now()) {
  const features = geojson.features;
  const rows = [];

  for (const feat of features) {
    const props = feat.properties || {};
    const coords = feat.geometry?.coordinates;
    const lon = coords?.[0] ?? props.Longitude;
    const lat = coords?.[1] ?? props.Latitude;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const mmsi = String(props.MMSI || '').trim();
    if (!mmsi) continue;

    const rawName = String(props.ShipName || '').trim();
    const name = rawName || `MMSI ${mmsi}`;
    const sog = aisSpeed(props.SOG);
    const cog = normalizeCourse(props.COG);
    const category = categorizeShip(props.Ship_and_Cargo_Type);
    const rawType = props.Ship_and_Cargo_Type;
    const shipTypeCode =
      rawType != null &&
      String(rawType).trim() !== '' &&
      Number.isFinite(Number(rawType))
        ? Number(rawType)
        : null;
    const recordEpochMs = parseRecordTime(props.Record_Time);

    rows.push({
      lat,
      lon,
      name,
      mmsi,
      imo: String(props.IMO_Number || '').trim(),
      callSign: String(props.Call_Sign || '').trim(),
      type: category.enName,
      categoryKey: category.id,
      shipTypeCode,
      categoryName: category.name,
      color: category.color,
      iconShape: category.icon,
      destination: 'Taiwan Coastal / Port',
      speed: sog,
      course: cog,
      heading: cog,
      source: 'MOTC_MPB',
      recordEpochMs,
      last_position_UTC:
        recordEpochMs === null
          ? props.Record_Time || new Date(now).toISOString()
          : new Date(recordEpochMs).toISOString(),
      last_position_epoch: Math.floor((recordEpochMs ?? now) / 1000),
    });
  }

  return rows;
}

/**
 * Vite plugin: Taiwan MOTC MPB Live Vessels Proxy
 * Mounts at `/api/taiwan-vessels`
 */
export async function getTaiwanVessels() {
  const rows = await getTaiwanVesselRows();
  return {
    rows,
    data_health: dataHealth(_lastFetchTime, CACHE_TTL_MS, _sourceError),
  };
}

export function taiwanVesselsProxy() {
  function install(middlewares) {
    middlewares.use('/api/taiwan-vessels', async (req, res) => {
      try {
        res.setHeader('X-Feed-Source', 'MOTC-Taiwan-MPB');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');

        const incoming = new URL(req.url || '', 'http://localhost');
        const typeFilter = incoming.searchParams.get('types'); // comma separated e.g. 'cargo,tanker'
        const filterSet = typeFilter
          ? new Set(typeFilter.split(',').map((s) => s.trim()))
          : null;

        let rows = await getTaiwanVesselRows();
        if (filterSet && filterSet.size > 0) {
          rows = rows.filter((r) => filterSet.has(r.categoryKey));
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            rows,
            total: rows.length,
            categories: MOTC_CATEGORIES,
            source: 'MOTC Taiwan MPB',
            status: dataHealth(_lastFetchTime, CACHE_TTL_MS, _sourceError)
              .status,
            data_health: dataHealth(_lastFetchTime, CACHE_TTL_MS, _sourceError),
            lastUpdated: new Date(_lastFetchTime).toISOString(),
          }),
        );
      } catch (err) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            error: err?.message || 'Failed to fetch Taiwan vessels',
            rows: [],
            data_health: { status: 'source_error', ageMs: null },
          }),
        );
      }
    });
  }

  return {
    name: 'taiwan-vessels-proxy',
    configureServer(server) {
      install(server.middlewares);
    },
    configurePreviewServer(server) {
      install(server.middlewares);
    },
  };
}
