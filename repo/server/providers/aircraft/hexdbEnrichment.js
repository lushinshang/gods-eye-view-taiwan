import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { readResponseJsonCapped } from '../common/http.js';
import { makeRateLimiter, clientKey } from '../common/rate-limit.js';

/** A single aircraft record is a few hundred bytes; 1 MiB is a hard bound. */
const HEXDB_MAX_RESPONSE_BYTES = 1024 * 1024;

/**
 * hexdb.io enrichment proxy: hex → registered owner/operator. Used only as a
 * fallback for military aircraft, whose upstream (adsb.lol) carries no
 * operator field at all and whose adsbdb coverage is also empty (see
 * sdd/archive/.../military-operator-enrichment). hexdb.io has no documented
 * terms of use or rate limit — weaker guarantees than adsb.lol/adsbdb — so
 * this is treated as best-effort and disclosed as such to the end user, not
 * as authoritative upstream data.
 *
 * Cached like enrichment.js (adsbdb): successes and not-found are both kept
 * for 24h and persisted to disk, bounded by an entry ceiling with
 * oldest-first eviction and a disk-size ceiling, guarded by a rate limiter.
 */
export function hexdbEnrichmentProxy(options = {}) {
  // Destructured in the body, not the signature: src/proxyErrorResponses.
  // test.mjs extracts this proxy by slicing to the first closing brace in
  // column zero (see enrichment.js/terrain.js for the same note).
  const {
    cacheMaxEntries = 50_000,
    cacheMaxDiskBytes = 24 * 1024 * 1024,
    cachePath,
  } = options;
  const TTL_MS = 24 * 3600_000;
  const CACHE_PATH =
    cachePath || path.join(process.cwd(), '.gev-cache', 'hexdb.json');
  let cache = new Map();
  let dirty = false;
  let loaded = false;
  const inflight = new Map();
  /** 90/min/client — same band enrichment.js uses for the same reason. */
  const allow = makeRateLimiter({ windowMs: 60_000, max: 90, globalMax: 270 });

  function evictOverflow() {
    for (const key of cache.keys()) {
      if (cache.size <= cacheMaxEntries) return;
      cache.delete(key);
    }
  }

  async function loadOnce() {
    if (loaded) return;
    loaded = true;
    try {
      let sizeBytes = null;
      try {
        sizeBytes = (await fsp.stat(CACHE_PATH)).size;
      } catch {
        sizeBytes = null;
      }
      if (sizeBytes !== null && sizeBytes > cacheMaxDiskBytes)
        throw new Error('cache file too large');
      const parsed = JSON.parse(await fsp.readFile(CACHE_PATH, 'utf8'));
      cache = new Map(Object.entries(parsed));
      evictOverflow();
    } catch {
      /* first run */
    }
    setInterval(async () => {
      if (!dirty) return;
      dirty = false;
      try {
        await fsp.mkdir(path.dirname(CACHE_PATH), { recursive: true });
        await fsp.writeFile(
          CACHE_PATH,
          JSON.stringify(Object.fromEntries(cache)),
          'utf8',
        );
      } catch {
        dirty = true;
      } // retry next tick
    }, 15_000).unref?.();
  }

  const fresh = (e) => e && Date.now() - e.at < TTL_MS;

  function parseOwner(json) {
    const owner = json?.RegisteredOwners;
    return typeof owner === 'string' && owner.trim() ? owner.trim() : null;
  }

  function lookup(hex) {
    if (fresh(cache.get(hex))) return Promise.resolve(cache.get(hex).owner);
    if (!inflight.has(hex)) {
      inflight.set(
        hex,
        (async () => {
          try {
            const url = `https://hexdb.io/api/v1/aircraft/${encodeURIComponent(hex)}`;
            const signal = AbortSignal.timeout(8000);
            const res = await fetch(url, { signal });
            if (res.ok) {
              const payload = await readResponseJsonCapped(
                res,
                HEXDB_MAX_RESPONSE_BYTES,
                signal,
              );
              const owner = parseOwner(payload);
              cache.set(hex, { at: Date.now(), owner }); // owner may be null — negative cache
              evictOverflow();
              dirty = true;
              return owner;
            }
            if (res.status === 404) {
              cache.set(hex, { at: Date.now(), owner: null }); // known-missing — cache the miss
              evictOverflow();
              dirty = true;
            }
            // other statuses: leave uncached so we retry later
            return fresh(cache.get(hex)) ? cache.get(hex).owner : null;
          } catch {
            return fresh(cache.get(hex)) ? cache.get(hex).owner : null; // network error → stale if any
          } finally {
            inflight.delete(hex);
          }
        })(),
      );
    }
    return inflight.get(hex);
  }

  const installMiddleware = (server) => {
    server.middlewares.use('/api/hexdb', async (req, res) => {
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
        const [, rawHex] = String(req.url || '')
          .split('?')[0]
          .split('/');
        const hex = String(rawHex || '').toLowerCase();
        if (!/^[0-9a-f]{6}$/.test(hex))
          return send(400, { error: 'invalid hex' });
        const owner = await lookup(hex);
        return send(200, owner ? { found: true, owner } : { found: false });
      } catch {
        console.error('[hexdb-proxy] request failed');
        return send(500, { error: 'hexdb proxy error' });
      }
    });
  };
  return {
    name: 'hexdb-proxy',
    configureServer: installMiddleware,
    configurePreviewServer: installMiddleware,
  };
}
