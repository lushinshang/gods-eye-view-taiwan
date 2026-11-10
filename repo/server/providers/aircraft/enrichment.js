import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { readResponseJsonCapped } from '../common/http.js';
import { makeRateLimiter, clientKey } from '../common/rate-limit.js';

/** Route and aircraft lookups are a few hundred bytes; 1 MiB is a hard bound. */
const ADSBDB_MAX_RESPONSE_BYTES = 1024 * 1024;
/**
 * adsbdb.com enrichment proxy: callsign → route (airline + origin/destination
 * airports) and hex → aircraft type/registration. Free community API — cached
 * aggressively: successes and 404s are kept per key for 24 hours (TTL_MS) and
 * persisted to disk so restarts don't re-hammer it; other failures are not
 * cached. Adapted from skylight
 * (MIT) server/src/enrich/routes.ts.
 *
 * Bounded like terrain.js's point cache (same upstream issue shape, fixed
 * there first): every distinct callsign or hex is its own permanent key, so
 * routes and aircraft each carry an independent entry ceiling with
 * oldest-first eviction.
 */
export function adsbdbProxy(options = {}) {
  // Destructured in the body, not the signature: src/proxyErrorResponses.test.mjs
  // extracts this proxy by slicing to the first closing brace in column
  // zero (see terrain.js for the same note). Overridable so the ceilings
  // can be exercised as behaviour, not asserted as constants; production
  // constructs this with no arguments.
  const {
    cacheMaxEntries = 50_000,
    cacheMaxDiskBytes = 24 * 1024 * 1024,
    cachePath,
  } = options;
  const TTL_MS = 24 * 3600_000;
  const CACHE_PATH =
    cachePath || path.join(process.cwd(), '.gev-cache', 'adsbdb.json');
  let cache = { routes: new Map(), aircraft: new Map() };
  let dirty = false;
  let loaded = false;
  const inflight = new Map();
  /**
   * 90/min/client — same band terrain.js uses for the same reason: adsbdb
   * is free and keyless, so this guards the point cache and the upstream
   * community API from enumeration (see issue #261) rather than a bill.
   */
  const allow = makeRateLimiter({ windowMs: 60_000, max: 90, globalMax: 270 });

  /**
   * Drop the oldest entries until a store is back inside its ceiling. Each
   * store is kept in insertion order (Map's native guarantee), and every
   * write re-inserts the key it just set, so the oldest-fetched entry is
   * always first — no sort needed, unlike terrain.js's `mem` (which can be
   * re-populated out of fetch order from disk and has to call `orderByAge`).
   */
  function evictOverflow(store) {
    for (const key of store.keys()) {
      if (store.size <= cacheMaxEntries) return;
      store.delete(key);
    }
  }

  async function loadOnce() {
    if (loaded) return;
    loaded = true;
    try {
      // A cache file past the ceiling is not read back into memory: loading
      // it would reinstate exactly the unbounded growth the ceiling exists
      // to stop. The next flush rewrites a bounded one. "Cannot measure it"
      // is not "too large": if stat is unavailable, fall through and let
      // readFile decide, so an absent file behaves exactly as it did before
      // this guard existed.
      let sizeBytes = null;
      try {
        sizeBytes = (await fsp.stat(CACHE_PATH)).size;
      } catch {
        sizeBytes = null;
      }
      if (sizeBytes !== null && sizeBytes > cacheMaxDiskBytes)
        throw new Error('cache file too large');
      const parsed = JSON.parse(await fsp.readFile(CACHE_PATH, 'utf8'));
      cache = {
        routes: new Map(Object.entries(parsed.routes ?? {})),
        aircraft: new Map(Object.entries(parsed.aircraft ?? {})),
      };
      // A ceiling lowered since the file was written, or a file from before
      // this ceiling existed, could hold more than the current cap.
      evictOverflow(cache.routes);
      evictOverflow(cache.aircraft);
    } catch {
      /* first run */
    }
    setInterval(async () => {
      if (!dirty) return;
      dirty = false;
      try {
        await fsp.mkdir(path.dirname(CACHE_PATH), { recursive: true });
        const obj = {
          routes: Object.fromEntries(cache.routes),
          aircraft: Object.fromEntries(cache.aircraft),
        };
        await fsp.writeFile(CACHE_PATH, JSON.stringify(obj), 'utf8');
      } catch {
        dirty = true;
      } // retry next tick
    }, 15_000).unref?.();
  }

  const fresh = (e) => e && Date.now() - e.at < TTL_MS;

  function parseRoute(json) {
    const fr = json?.response?.flightroute;
    if (!fr?.origin || !fr?.destination) return null;
    const airport = (a) => ({
      code: a.iata_code || a.icao_code || '',
      name: a.municipality || a.name || '',
      lat: Number.isFinite(a.latitude) ? a.latitude : null,
      lon: Number.isFinite(a.longitude) ? a.longitude : null,
    });
    return {
      airline: fr.airline?.name || null,
      origin: airport(fr.origin),
      destination: airport(fr.destination),
    };
  }

  function parseAircraft(json) {
    const a = json?.response?.aircraft;
    if (!a) return null;
    return {
      typeCode: a.icao_type || null, // ICAO designator, e.g. "B738" — feeds classifyAircraft
      typeName:
        a.manufacturer && a.type
          ? `${a.manufacturer} ${a.type}`
          : a.type || null,
      registration: a.registration || null,
    };
  }

  function lookup(kind, key) {
    const store = kind === 'route' ? cache.routes : cache.aircraft;
    if (fresh(store.get(key))) return Promise.resolve(store.get(key).data);
    const ik = `${kind}:${key}`;
    if (!inflight.has(ik)) {
      inflight.set(
        ik,
        (async () => {
          try {
            const url =
              kind === 'route'
                ? `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(key)}`
                : `https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(key)}`;
            const signal = AbortSignal.timeout(8000);
            const res = await fetch(url, { signal });
            if (res.ok) {
              const payload = await readResponseJsonCapped(
                res,
                ADSBDB_MAX_RESPONSE_BYTES,
                signal,
              );
              const data =
                kind === 'route' ? parseRoute(payload) : parseAircraft(payload);
              store.set(key, { at: Date.now(), data }); // data may be null — negative cache
              evictOverflow(store);
              dirty = true;
              return data;
            }
            if (res.status === 404) {
              store.set(key, { at: Date.now(), data: null }); // known-missing — cache the miss
              evictOverflow(store);
              dirty = true;
            }
            // other statuses: leave uncached so we retry later
            return fresh(store.get(key)) ? store.get(key).data : null;
          } catch {
            return fresh(store.get(key)) ? store.get(key).data : null; // network error → stale if any
          } finally {
            inflight.delete(ik);
          }
        })(),
      );
    }
    return inflight.get(ik);
  }

  const installMiddleware = (server) => {
    server.middlewares.use('/api/adsbdb', async (req, res) => {
      await loadOnce();
      const send = (status, obj) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      try {
        if (!allow(clientKey(req))) {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': '10',
          });
          res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
          return;
        }
        const [, kind, rawKey] = String(req.url || '')
          .split('?')[0]
          .split('/');
        if (kind === 'route') {
          const cs = String(rawKey || '').toUpperCase();
          if (!/^[A-Z0-9]{2,8}$/.test(cs))
            return send(400, { error: 'invalid callsign' });
          const data = await lookup('route', cs);
          return send(200, data ? { found: true, ...data } : { found: false });
        }
        if (kind === 'type') {
          const hex = String(rawKey || '').toLowerCase();
          if (!/^[0-9a-f]{6}$/.test(hex))
            return send(400, { error: 'invalid hex' });
          const data = await lookup('aircraft', hex);
          return send(200, data ? { found: true, ...data } : { found: false });
        }
        return send(404, { error: 'unknown endpoint' });
      } catch (err) {
        console.error('[adsbdb-proxy] request failed');
        return send(500, { error: 'adsbdb proxy error' });
      }
    });
  };
  return {
    name: 'adsbdb-proxy',
    configureServer: installMiddleware,
    configurePreviewServer: installMiddleware,
  };
}
