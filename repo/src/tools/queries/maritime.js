/** Maritime queries over the live vessel source (src/sources/live). */

import { suggestView } from '../views.js';
import { defineTool, ToolError } from '../catalog.js';
import {
  AREA_SCHEMA,
  areaCenter,
  areaContains,
  areaRadiusKm,
  distanceKm,
  resolveArea,
} from '../area.js';
import {
  LIMIT_SCHEMA,
  breakdown,
  breakdownPhrase,
  capRows,
  countNoun,
  isoTime,
  numericSummary,
  thinEvenly,
} from '../results.js';
import { normalizeVesselType } from '../../data/vesselTypes.js';

const MMSI_SCHEMA = Object.freeze({
  type: 'string',
  pattern: '^\\d{5,10}$',
  description: 'Maritime Mobile Service Identity, such as "366999712".',
});
const MAX_TRACK_POINTS = 200;
const ALL_VESSELS = 1_000_000;

const round = (value, digits) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const text = (value) => (typeof value === 'string' && value ? value : null);
// AIS sends ship types as ITU-R M.1371 codes ("70" to "79" are all cargo), so
// a code reads as its family ("CARGO"), which is what group_by counts and the
// type filter matches; text types pass through. Type 0 is "not available" and
// reads as unknown.
const vesselType = (value) => normalizeVesselType(text(value) ?? '') || null;

// Crews type the destination by hand; one with no letters ("0", "---") names
// no port and reads as unknown.
const vesselDestination = (value) => {
  const destination = text(value);
  return destination && /\p{L}/u.test(destination) ? destination : null;
};

function vesselRow(record, from) {
  const point = { lat: record.latitude, lon: record.longitude };
  return {
    mmsi: record.id,
    name: text(record.name),
    imo: text(record.imo),
    ...(record.callSign ? { call_sign: text(record.callSign) } : {}),
    type: vesselType(record.type) ?? text(record.type),
    ...(record.twType ? { tw_category: record.twType } : {}),
    ...(record.twCategoryName
      ? { tw_category_name: record.twCategoryName }
      : {}),
    destination: vesselDestination(record.destination),
    lat: round(record.latitude, 5),
    lon: round(record.longitude, 5),
    speed_mps: round(record.speedMps, 1),
    ...(Number.isFinite(record.speedKnots)
      ? { speed_knots: round(record.speedKnots, 1) }
      : {}),
    course_deg: round(record.courseDeg, 0),
    heading_deg: round(record.headingDeg, 0),
    observed_at: isoTime(record.observedAtMs),
    ...(record.source ? { source: record.source } : {}),
    ...(from ? { distance_km: round(distanceKm(from, point), 1) } : {}),
  };
}

/**
 * Every vessel the source retains, or with `area`, every vessel around it.
 * Also merges Taiwan MOTC MPB live vessels (`services.taiwanVessels`) when
 * available so `vessels_in_area` and `find_vessel` cover Taiwan's 9,000+ ships.
 */
async function readVessels(services, signal, area) {
  const center = area ? areaCenter(area) : null;
  const globalPromise = services.vessels
    ? services.vessels
        .getSnapshot(
          {
            maxRows: ALL_VESSELS,
            ...(center
              ? {
                  area: {
                    lat: center.lat,
                    lon: center.lon,
                    radiusKm: areaRadiusKm(area),
                  },
                }
              : {}),
          },
          { signal },
        )
        .catch(() => ({ records: [], freshness: 'unknown' }))
    : Promise.resolve({ records: [], freshness: 'unknown' });

  const taiwanPromise = services.taiwanVessels
    ? services.taiwanVessels.getSnapshot({ signal }).catch(() => ({ rows: [] }))
    : Promise.resolve({ rows: [] });

  const [snapshot, twSnapshot] = await Promise.all([
    globalPromise,
    taiwanPromise,
  ]);
  const baseRecords = Array.isArray(snapshot?.records) ? snapshot.records : [];
  const twRows = Array.isArray(twSnapshot?.rows) ? twSnapshot.rows : [];

  if (twRows.length === 0) return snapshot;

  const seenMmsi = new Set(baseRecords.map((r) => String(r.id)));
  const merged = [...baseRecords];
  for (const tw of twRows) {
    if (!seenMmsi.has(String(tw.id))) {
      seenMmsi.add(String(tw.id));
      merged.push(tw);
    }
  }

  return {
    ...snapshot,
    records: merged,
    source: snapshot?.source
      ? `${snapshot.source} + MOTC Taiwan MPB`
      : 'MOTC Taiwan MPB',
    observedAtMs: Math.max(
      snapshot?.observedAtMs || 0,
      twSnapshot?.observedAtMs || 0,
    ),
    freshness:
      twSnapshot?.freshness === 'live'
        ? 'live'
        : (snapshot?.freshness ?? 'live'),
  };
}

function snapshotInfo(snapshot) {
  return {
    source: snapshot.source ?? null,
    coverage: snapshot.coverage ?? null,
    observed_at: isoTime(snapshot.observedAtMs),
    freshness: snapshot.freshness ?? 'unknown',
  };
}

export const vesselsInArea = defineTool({
  name: 'vessels_in_area',
  title: 'Vessels in an area',
  description:
    'Ships currently reported by AIS inside an area, nearest the center ' +
    'first, optionally filtered by vessel type. group_by counts every matched ' +
    'ship by type or destination, and stats summarizes their speed; both ' +
    'cover all matches, not just the rows returned.',
  inputSchema: {
    type: 'object',
    properties: {
      area: AREA_SCHEMA,
      type: {
        type: 'string',
        minLength: 1,
        maxLength: 40,
        description: 'Vessel type to match, such as "tanker" or "cargo".',
      },
      group_by: {
        type: 'string',
        enum: ['type', 'destination'],
        description: 'Count matched vessels by this field, largest first.',
      },
      stats: {
        type: 'boolean',
        description: 'Summarize speed over matched vessels.',
      },
      limit: LIMIT_SCHEMA,
    },
    required: ['area'],
    additionalProperties: false,
  },
  requires: ['vessels'],
  async run(args, { services, signal }) {
    const area = await resolveArea(args.area, { services, signal });
    const center = areaCenter(area);
    const snapshot = await readVessels(services, signal, area);
    const wanted = args.type?.toLowerCase();
    const rows = snapshot.records
      .filter(
        (record) =>
          areaContains(area, { lat: record.latitude, lon: record.longitude }) &&
          (!wanted ||
            (vesselType(record.type) ?? '').toLowerCase().includes(wanted)),
      )
      .map((record) => vesselRow(record, center))
      .sort((a, b) => a.distance_km - b.distance_km);
    const kind = args.type ? `${args.type} vessel` : 'vessel';
    const groups = args.group_by ? breakdown(rows, args.group_by) : null;
    return {
      summary:
        `${countNoun(rows.length, kind)} in ${area.label}` +
        (groups ? breakdownPhrase(groups, args.group_by) : '') +
        (snapshot.freshness === 'stale' ? ' (data may be stale).' : '.'),
      data: {
        view: suggestView(services, { area, layers: ['ais-live-vessels'] }),
        ...capRows(rows, args.limit),
        ...(groups ? { breakdown: groups } : {}),
        ...(args.stats
          ? { stats: { speed_mps: numericSummary(rows, 'speed_mps') } }
          : {}),
        ...snapshotInfo(snapshot),
      },
    };
  },
});

export const findVessel = defineTool({
  name: 'find_vessel',
  title: 'Find a vessel',
  description:
    'Find ships currently reported anywhere by MMSI, IMO number or name. ' +
    'Names match when they contain the given text.',
  inputSchema: {
    type: 'object',
    properties: {
      mmsi: MMSI_SCHEMA,
      imo: { type: 'string', pattern: '^\\d{7}$' },
      name: { type: 'string', minLength: 2, maxLength: 60 },
      limit: LIMIT_SCHEMA,
    },
    additionalProperties: false,
  },
  requires: ['vessels'],
  async run(args, { services, signal }) {
    const given = ['mmsi', 'imo', 'name'].filter((key) => args[key] != null);
    if (given.length !== 1)
      throw new ToolError(
        'invalid_arguments',
        'Give exactly one of mmsi, imo or name',
      );
    const [key] = given;
    const wanted = args[key].trim().toUpperCase();
    const matches = {
      mmsi: (record) => record.id === wanted,
      imo: (record) => String(record.imo).replace(/^IMO/i, '') === wanted,
      name: (record) => String(record.name).toUpperCase().includes(wanted),
    }[key];
    const snapshot = await readVessels(services, signal);
    const rows = snapshot.records
      .filter(matches)
      .map((record) => vesselRow(record));
    return {
      summary: rows.length
        ? `Found ${countNoun(rows.length, 'vessel')} with ${key} ${args[key]}.`
        : `No vessel with ${key} ${args[key]} is currently reported.`,
      data: {
        // Ships cannot be followed from a link; one match is framed closely.
        view:
          rows.length === 1
            ? suggestView(services, {
                point: { lat: rows[0].lat, lon: rows[0].lon },
                layers: ['ais-live-vessels'],
                altitudeM: 5_000,
              })
            : null,
        ...capRows(rows, args.limit),
        ...snapshotInfo(snapshot),
      },
    };
  },
});

export const getVesselTrack = defineTool({
  name: 'get_vessel_track',
  title: 'Vessel track',
  description:
    'Recent positions of one ship by MMSI, oldest first. Long tracks are ' +
    `evenly thinned to at most ${MAX_TRACK_POINTS} points.`,
  inputSchema: {
    type: 'object',
    properties: { mmsi: MMSI_SCHEMA },
    required: ['mmsi'],
    additionalProperties: false,
  },
  requires: ['vessels'],
  async run(args, { services, signal }) {
    const track = await services.vessels.getTrack(args.mmsi, { signal });
    const points = track.records
      .filter((point) => Number.isFinite(point.observedAtMs))
      .sort((a, b) => a.observedAtMs - b.observedAtMs);
    const kept = thinEvenly(points, MAX_TRACK_POINTS);
    return {
      summary: points.length
        ? `${countNoun(points.length, 'position')} for ${args.mmsi} from ${isoTime(points[0].observedAtMs)} to ${isoTime(points.at(-1).observedAtMs)}.`
        : `No recent track is available for ${args.mmsi}.`,
      data: {
        view: kept.length
          ? suggestView(services, {
              point: { lat: kept.at(-1).latitude, lon: kept.at(-1).longitude },
              layers: ['ais-live-vessels'],
              altitudeM: 20_000,
            })
          : null,
        mmsi: args.mmsi,
        total: points.length,
        returned: kept.length,
        thinned: kept.length < points.length,
        points: kept.map((point) => ({
          time: isoTime(point.observedAtMs),
          lat: round(point.latitude, 5),
          lon: round(point.longitude, 5),
        })),
      },
    };
  },
});

const TW_CATEGORY_ALIASES = Object.freeze({
  cargo: 'cargo',
  tanker: 'tanker',
  fishing: 'fishing',
  passenger: 'passenger',
  highspeed: 'highspeed',
  special_ops: 'special_ops',
  special: 'special_ops',
  law: 'special_ops',
  pilot: 'special_ops',
  sar: 'special_ops',
  pleasure_craft: 'pleasure_craft',
  tug: 'pleasure_craft',
  yacht: 'pleasure_craft',
  unspecified: 'unspecified',
  other: 'unspecified',
});

export const taiwanVesselsInArea = defineTool({
  name: 'taiwan_vessels_in_area',
  title: 'Taiwan MOTC MPB vessels in an area',
  description:
    'Live vessels reported by Taiwan MOTC Maritime and Port Bureau (航港局) ' +
    'radar/AIS (~9,000+ ships around Taiwan), optionally filtered by official ' +
    '8 vessel categories (cargo, tanker, fishing, passenger, highspeed, ' +
    'special_ops/law, pleasure_craft/tug, unspecified/other) and area.',
  inputSchema: {
    type: 'object',
    properties: {
      area: AREA_SCHEMA,
      category: {
        type: 'string',
        description:
          'Taiwan vessel category filter: cargo, tanker, fishing, passenger, ' +
          'highspeed, special_ops (or law/special), pleasure_craft (or tug), unspecified (or other).',
      },
      stats: {
        type: 'boolean',
        description: 'Summarize speed (knots and m/s) over matched vessels.',
      },
      limit: LIMIT_SCHEMA,
    },
    additionalProperties: false,
  },
  requires: ['taiwanVessels'],
  async run(args, { services, signal }) {
    const defaultArea = { lat: 23.7, lon: 120.5, radius_km: 350 };
    const area = await resolveArea(args.area ?? defaultArea, {
      services,
      signal,
    });
    const center = areaCenter(area);
    const rawCat = args.category?.trim().toLowerCase();
    const mappedCat = rawCat ? (TW_CATEGORY_ALIASES[rawCat] ?? rawCat) : null;

    const snapshot = await services.taiwanVessels.getSnapshot({
      types: mappedCat || undefined,
      signal,
    });

    const rows = snapshot.rows
      .filter((record) =>
        areaContains(area, { lat: record.latitude, lon: record.longitude }),
      )
      .map((record) => vesselRow(record, center))
      .sort((a, b) => a.distance_km - b.distance_km);

    const groups = breakdown(rows, 'tw_category');
    const kind = mappedCat ? `${mappedCat} Taiwan vessel` : 'Taiwan vessel';

    return {
      summary:
        `${countNoun(rows.length, kind)} in ${area.label}` +
        (groups.length ? breakdownPhrase(groups, 'tw_category') : '') +
        '.',
      data: {
        view: suggestView(services, { area, layers: ['ais-live-vessels'] }),
        ...capRows(rows, args.limit),
        breakdown: groups,
        ...(args.stats
          ? {
              stats: {
                speed_knots: numericSummary(rows, 'speed_knots'),
                speed_mps: numericSummary(rows, 'speed_mps'),
              },
            }
          : {}),
        ...snapshotInfo(snapshot),
      },
    };
  },
});

const TAIWAN_TRACK_HOURS = Object.freeze([6, 24, 168]);

export const getTaiwanVesselTrack = defineTool({
  name: 'taiwan_vessel_track',
  title: 'Taiwan vessel rolling track',
  description:
    'Historical track of one ship around Taiwan from the server-side rolling ' +
    '7-day store built from MOTC MPB reports (distance, average/max speed, ' +
    'straightness and a provisional loitering flag). Oldest point first; ' +
    `evenly thinned to at most ${MAX_TRACK_POINTS} points.`,
  inputSchema: {
    type: 'object',
    properties: {
      mmsi: {
        type: 'string',
        pattern: '^\\d{9}$',
        description:
          'Nine-digit MMSI of a Taiwan MPB vessel, such as "416460000".',
      },
      hours: {
        type: 'number',
        enum: TAIWAN_TRACK_HOURS,
        description:
          'Look-back window in hours: 6, 24 (default) or 168 (7 days).',
      },
    },
    required: ['mmsi'],
    additionalProperties: false,
  },
  requires: ['taiwanVessels'],
  async run(args, { services, signal }) {
    const hours = args.hours ?? 24;
    const track = await services.taiwanVessels.getTrack(args.mmsi, {
      hours,
      signal,
    });
    const points = (Array.isArray(track?.points) ? track.points : [])
      .filter((point) => Number.isFinite(point.t))
      .sort((a, b) => a.t - b.t);
    const kept = thinEvenly(points, MAX_TRACK_POINTS);
    const stats = track?.stats ?? {};
    return {
      summary: points.length
        ? `${countNoun(points.length, 'position')} for ${args.mmsi} (${track.name || 'unnamed'}) over the last ${hours}h, ` +
          `${round(stats.distanceKm ?? 0, 1)} km` +
          (stats.loiter ? '; possible loitering.' : '.')
        : `No stored track for ${args.mmsi} in the last ${hours}h (the store only holds positions recorded while the server ran).`,
      data: {
        view: kept.length
          ? suggestView(services, {
              point: { lat: kept.at(-1).lat, lon: kept.at(-1).lon },
              layers: ['ais-live-vessels'],
              altitudeM: 20_000,
            })
          : null,
        mmsi: args.mmsi,
        name: track?.name || null,
        hours,
        total: points.length,
        returned: kept.length,
        thinned: kept.length < points.length || Boolean(track?.thinned),
        stats: {
          distance_km: round(stats.distanceKm ?? 0, 2),
          avg_speed_knots: round(stats.avgSpeedKn, 1),
          max_speed_knots: round(stats.maxSpeedKn, 1),
          span_minutes: Math.round((stats.spanMs ?? 0) / 60_000),
          net_displacement_km: round(stats.netDisplacementKm ?? 0, 2),
          straightness: round(stats.straightness ?? 0, 3),
          loiter: Boolean(stats.loiter),
        },
        points: kept.map((point) => ({
          time: isoTime(point.t),
          lat: round(point.lat, 5),
          lon: round(point.lon, 5),
          speed_knots: point.s ?? null,
          course_deg: point.c ?? null,
        })),
      },
    };
  },
});
