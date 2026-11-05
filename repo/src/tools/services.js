/**
 * The default services Core's tools read: the layers' portable source
 * factories and the application request services. `fetchImpl` must resolve
 * the sources' relative `/api/...` paths; in a browser the page's own fetch
 * does, and elsewhere a caller supplies a resolving fetch. `appUrl` is the
 * address the app is served from; `app.fetch` requests the app's own paths.
 * `panelKey`, when the panel is offered, is the key its page carries, which
 * the panel's requests must include.
 */

import { createAlprTileSource } from '../layers/alpr/source.js';
import { GBFS_CITY_REGISTRY } from '../layers/bikeshare/registry.js';
import { createBikeshareSource } from '../layers/bikeshare/source.js';
import { createCctvSource } from '../layers/cctv/source.js';
import { createCycloneSource } from '../layers/cyclones/source.js';
import { createUsgsEarthquakeSource } from '../layers/earthquakes/source.js';
import { createFirmsSource } from '../layers/firms/source.js';
import { createInstallationSource } from '../layers/installations/source.js';
import { createLaunchSource } from '../layers/launches/source.js';
import { createWfigsPerimeterSource } from '../layers/perimeters/source.js';
import { createRadioSource } from '../layers/radio/source.js';
import { createBundledCableSource } from '../layers/submarineCables/bundledSource.js';
import { searchHls } from '../layers/recentImagery/catalog.js';
import { rankLatest, wvsSnapshotUrl } from '../layers/recentImagery/model.js';
import { createSatelliteSource } from '../layers/satellites/source.js';
import { createTrafficSource } from '../layers/traffic/source.js';
import { createTransitSource } from '../layers/transit/source.js';
import { createWeatherSource } from '../layers/weather/source.js';
import { createWindSource } from '../layers/wind/source.js';
import { createApplicationRequestServices } from '../services/requests.js';
import { createEventPackSource } from '../sources/eventPacks.js';
import { createInfrastructureSource } from '../sources/infrastructureData.js';
import {
  createMilitarySource,
  createVesselSource,
  createFlightSource,
} from '../sources/live/standalone.js';
import {
  createGeocodePlaceService,
  createPlaceSearchService,
  createRouteService,
} from './places.js';

/** Construct every service Core's tools read. */
export function createToolServices({ fetchImpl, appUrl, panelKey }) {
  if (typeof fetchImpl !== 'function')
    throw new TypeError('A fetch implementation is required');
  const requests = createApplicationRequestServices({ fetchImpl });
  return {
    app: { baseUrl: appUrl, fetch: fetchImpl, panelKey },
    earthquakes: createUsgsEarthquakeSource({ fetchImpl }),
    fires: createFirmsSource({ fetchImpl }),
    launches: createLaunchSource({ fetchImpl }),
    aircraft: createFlightSource({ fetchImpl }),
    military: createMilitarySource({ fetchImpl }),
    vessels: createVesselSource({
      fetchImpl,
      origin: () => new URL(appUrl).origin,
    }),
    taiwanVessels: createTaiwanVesselService({ fetchImpl }),
    taiwanTraffic: createTaiwanTrafficService({ fetchImpl }),
    satellites: createSatelliteSource({ fetchImpl }),
    cctv: createCctvSource({ fetchImpl }),
    radio: createRadioSource({ fetchImpl }),
    placeSearch: createPlaceSearchService({ fetchImpl }),
    routing: createRouteService({ fetchImpl }),
    bikeshare: {
      systems: GBFS_CITY_REGISTRY,
      getStations: createBikeshareSource({ fetchImpl }).getStations,
    },
    transit: createTransitSource({ fetchImpl }),
    traffic: createTrafficSource({ fetchImpl, tileFetchImpl: fetchImpl }),
    weather: requests.weather,
    weatherMaps: createWeatherSource({ fetchImpl }),
    wind: createWindSource({ fetchImpl }),
    imagery: createImageryService({ fetchImpl }),
    cables: createBundledCableSource({ fetchImpl }),
    alpr: createAlprTileSource({ tileFetchImpl: fetchImpl }),
    infrastructure: createInfrastructureSource({ fetchImpl }),
    events: createEventPackSource({ fetchImpl }),
    regional: requests.regional,
    terrain: requests.terrain,
    summary: requests.summary,
    features: requests.features,
    cyclones: createCycloneSource({ fetchImpl }),
    perimeters: createWfigsPerimeterSource({ fetchImpl }),
    installations: createInstallationSource({
      fetchImpl,
      tileFetchImpl: fetchImpl,
    }),
    places: createGeocodePlaceService({ fetchImpl }),
  };
}

/** Recent keyless satellite imagery: the clearest recent day and its image. */
function createImageryService({ fetchImpl }) {
  return {
    async latest({ box, signal }) {
      const result = await searchHls({ box, fetchImpl, signal });
      return {
        ...rankLatest(result.candidates, { truncated: result.truncated }),
        errors: result.errors,
      };
    },
    async getSnapshot({ product, day, box, width, height, signal }) {
      const response = await fetchImpl(
        wvsSnapshotUrl({ product, day, box, width, height }),
        { signal },
      );
      if (!response.ok) throw new Error(`Imagery HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const type = response.headers.get('content-type') || '';
      return { contentType: type.split(';')[0].trim().toLowerCase(), bytes };
    },
  };
}

/** Taiwan MOTC MPB (航港局) live vessel telemetry service (`/api/taiwan-vessels`). */
function createTaiwanVesselService({ fetchImpl }) {
  const KNOTS_TO_MPS = 0.514444;
  return {
    async getSnapshot({ types, signal } = {}) {
      const query = types ? `?types=${encodeURIComponent(types)}` : '';
      const response = await fetchImpl(`/api/taiwan-vessels${query}`, {
        signal,
      });
      if (!response.ok) {
        throw new Error(`Taiwan vessels HTTP ${response.status}`);
      }
      const payload = await response.json();
      const rawRows = Array.isArray(payload?.rows) ? payload.rows : [];
      const observedAtMs = payload?.lastUpdated
        ? Date.parse(payload.lastUpdated) || Date.now()
        : Date.now();
      const rows = rawRows.map((r) => {
        const sog = Number.isFinite(r.speed) ? r.speed : null;
        return {
          id: String(r.mmsi || '').trim(),
          mmsi: String(r.mmsi || '').trim(),
          name: r.name || null,
          imo: r.imo || null,
          callSign: r.callSign || null,
          type: r.type || 'Unspecified',
          twType: r.categoryKey || 'unspecified',
          twCategoryName: r.categoryName || '未具體說明的船舶',
          destination: r.destination || 'Taiwan Coastal / Port',
          latitude: r.lat,
          longitude: r.lon,
          speedKnots: sog,
          speedMps: sog !== null ? sog * KNOTS_TO_MPS : null,
          courseDeg: Number.isFinite(r.course) ? r.course : null,
          headingDeg: Number.isFinite(r.heading) ? r.heading : null,
          observedAtMs: r.last_position_epoch
            ? r.last_position_epoch * 1000
            : observedAtMs,
          source: 'MOTC_MPB',
        };
      });
      return {
        rows,
        total: rows.length,
        categories: payload?.categories ?? {},
        source: payload?.source ?? 'MOTC Taiwan MPB',
        coverage: 'Taiwan Strait & Surrounding Waters',
        observedAtMs,
        freshness: 'live',
      };
    },

    /** Rolling 7-day track store (`/api/taiwan-vessel-tracks`). */
    async getTrack(mmsi, { hours = 24, signal } = {}) {
      const response = await fetchImpl(
        `/api/taiwan-vessel-tracks?mmsi=${encodeURIComponent(mmsi)}&hours=${encodeURIComponent(hours)}`,
        { signal },
      );
      if (!response.ok) {
        throw new Error(`Taiwan vessel tracks HTTP ${response.status}`);
      }
      return response.json();
    },
  };
}

/** Taiwan land traffic (高公局 TISVCloud / 警廣) service (`/api/taiwan-traffic`). */
function createTaiwanTrafficService({ fetchImpl }) {
  return {
    async getSnapshot({ types, road, signal } = {}) {
      const params = new URLSearchParams();
      if (types) params.set('types', types);
      if (road) params.set('road', road);
      const response = await fetchImpl(`/api/taiwan-traffic?${params}`, {
        signal,
      });
      if (!response.ok) {
        throw new Error(`Taiwan traffic HTTP ${response.status}`);
      }
      const payload = await response.json();
      const speeds = Array.isArray(payload?.speeds) ? payload.speeds : [];
      const known = speeds.filter((s) => Number.isFinite(s.speedKmh));
      return {
        events: Array.isArray(payload?.events) ? payload.events : [],
        sources: payload?.sources ?? {},
        updatedAt: payload?.updatedAt ?? null,
        speedStats: {
          sections: known.length,
          avg_speed_kmh: known.length
            ? Math.round(
                known.reduce((sum, s) => sum + s.speedKmh, 0) / known.length,
              )
            : null,
          slowest: [...known]
            .sort((a, b) => a.speedKmh - b.speedKmh)
            .slice(0, 10)
            .map((s) => ({
              name: s.name,
              direction: s.direction,
              speed_kmh: s.speedKmh,
              lat: s.lat,
              lon: s.lon,
            })),
        },
      };
    },
  };
}
