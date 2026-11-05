/** Taiwan land traffic: live freeway events and section speeds. */

import { defineTool } from '../catalog.js';
import {
  AREA_SCHEMA,
  areaCenter,
  areaContains,
  distanceKm,
  resolveArea,
} from '../area.js';
import {
  LIMIT_SCHEMA,
  breakdown,
  breakdownPhrase,
  capRows,
  countNoun,
} from '../results.js';

const EVENT_TYPES = ['accident', 'roadwork', 'congestion', 'control', 'other'];
const TYPE_ALIASES = Object.freeze({
  事故: 'accident',
  施工: 'roadwork',
  壅塞: 'congestion',
  管制: 'control',
  其他: 'other',
});

export const taiwanTrafficEvents = defineTool({
  name: 'taiwan_traffic_events',
  title: 'Taiwan live traffic events',
  description:
    'Live Taiwan freeway (國道) traffic events from the Freeway Bureau TISVCloud ' +
    '(and 警廣 PBS when reachable): accidents, roadwork, congestion, controls, with ' +
    'coordinates, nearest section speed (km/h) and timestamps. Optionally filtered ' +
    'by type, road name and area, with network-wide speed statistics.',
  inputSchema: {
    type: 'object',
    properties: {
      area: AREA_SCHEMA,
      type: {
        type: 'string',
        description:
          'Event type: accident (事故), roadwork (施工), congestion (壅塞), control (管制), other (其他).',
      },
      road: {
        type: 'string',
        description: 'Road name substring, such as 國道一號 or 國道三號.',
      },
      stats: {
        type: 'boolean',
        description:
          'Include freeway section speed statistics (average, slow sections).',
      },
      limit: LIMIT_SCHEMA,
    },
    additionalProperties: false,
  },
  requires: ['taiwanTraffic'],
  async run(args, { services, signal }) {
    const rawType = args.type?.trim().toLowerCase();
    const type = rawType ? (TYPE_ALIASES[rawType] ?? rawType) : null;
    const snapshot = await services.taiwanTraffic.getSnapshot({
      types: type && EVENT_TYPES.includes(type) ? type : undefined,
      road: args.road?.trim() || undefined,
      signal,
    });
    const area = args.area
      ? await resolveArea(args.area, { services, signal })
      : null;
    const center = area ? areaCenter(area) : null;
    const rows = snapshot.events
      .filter((e) => !area || areaContains(area, { lat: e.lat, lon: e.lon }))
      .map((e) => ({
        ...e,
        ...(center
          ? { distance_km: Number(distanceKm(center, e).toFixed(1)) }
          : {}),
      }));
    if (center) rows.sort((a, b) => a.distance_km - b.distance_km);
    const groups = breakdown(rows, 'type');
    return {
      summary:
        `${countNoun(rows.length, 'Taiwan traffic event')}` +
        (area ? ` in ${area.label}` : ' on Taiwan freeways') +
        (groups.groups.length ? breakdownPhrase(groups, 'type') : '') +
        '.',
      data: {
        ...capRows(rows, args.limit),
        breakdown: groups,
        sources: snapshot.sources,
        updated_at: snapshot.updatedAt,
        ...(args.stats ? { speed_stats: snapshot.speedStats } : {}),
      },
    };
  },
});
