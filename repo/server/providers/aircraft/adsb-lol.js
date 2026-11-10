import {
  coalesceProxyRequest,
  readResponseTextCapped,
} from '../common/http.js';
import { mergeAircraftByHex } from './militaryFeedMerge.js';

/** Response cache TTL (ms), shared by every upstream this proxy polls. */
const CACHE_MS = 12000;
/** Upstream deadline (ms); an unbounded fetch could hang a poll. */
const UPSTREAM_TIMEOUT_MS = 12000;
/** /v2/mil measures ~67 KB; a relayed error page is bounded by the same cap. */
const MIL_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
/** Cooldown after a 429 when upstream sends no usable Retry-After (ms). */
const RATE_LIMIT_COOLDOWN_MS = 30000;
/** Cooldown after a 5xx (ms). */
const SERVER_ERROR_COOLDOWN_MS = 15000;
/** Bounds for an upstream-supplied Retry-After (ms). */
const COOLDOWN_MIN_MS = 5000;
const COOLDOWN_MAX_MS = 120000;

const clampCooldown = (ms) =>
  Math.min(COOLDOWN_MAX_MS, Math.max(COOLDOWN_MIN_MS, ms));

/** Cooldown (ms) an upstream failure earns, honouring Retry-After when sane. */
function cooldownFor(upstream, now) {
  const raw = upstream.headers?.get?.('retry-after');
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0)
      return clampCooldown(seconds * 1000);
    const at = Date.parse(raw);
    if (Number.isFinite(at) && at > now) return clampCooldown(at - now);
  }
  return upstream.status === 429
    ? RATE_LIMIT_COOLDOWN_MS
    : SERVER_ERROR_COOLDOWN_MS;
}

/**
 * One upstream's independent fetch/cache/cooldown state machine, so one
 * source's failure or rate limit never affects another source polled
 * alongside it (see createMilitaryFeed below). Behavior for a single
 * instance is unchanged from the pre-refactor single-upstream version:
 * 12 s response cache; on a thrown fetch or a non-OK status such as 429,
 * serves the cached body as STALE instead of relaying the failure, and
 * backs off from upstream for the Retry-After period (bounded) so a rate
 * limit is never hammered mid-cooldown. A failure with nothing cached is
 * relayed as-is.
 * @param {{url: string, label: string, userAgent: string}} config
 */
function createMilSourceFeed({ url, label, userAgent }) {
  /** @type {string|null} Cached upstream JSON body. */
  let _cache = null;
  const inFlight = new Map();
  /** @type {number} Epoch-ms when the cache was populated. */
  let _cacheAt = 0;
  /** @type {number} Epoch-ms until which upstream is not contacted. */
  let _cooldownUntil = 0;
  /** @type {number} Upstream status that started the current cooldown. */
  let _cooldownStatus = 0;

  const result = (status, body, cacheStatus, extra = {}) => ({
    status,
    body,
    cacheStatus,
    extra,
    label,
    ageMs:
      cacheStatus === 'HIT' || cacheStatus === 'STALE'
        ? Math.max(0, Date.now() - _cacheAt)
        : 0,
  });

  /**
   * Resolves this source's current best answer: a fresh cache hit, a
   * cooldown-era stale serve, or a live fetch (which updates the cache and
   * cooldown state for next time).
   * @returns {Promise<{status: number, body: string, cacheStatus: 'HIT'|'STALE'|'MISS'|'NONE', extra: object, label: string, ageMs: number}>}
   */
  async function get() {
    const now = Date.now();
    if (_cache && now - _cacheAt < CACHE_MS) {
      return result(200, _cache, 'HIT');
    }
    if (now < _cooldownUntil) {
      const retryAfter = String(Math.ceil((_cooldownUntil - now) / 1000));
      if (_cache) {
        return result(200, _cache, 'STALE', {
          'X-ADS-B-Upstream-Status': String(_cooldownStatus),
          'X-ADS-B-Retry-After-Seconds': retryAfter,
        });
      }
      return result(
        _cooldownStatus || 503,
        JSON.stringify({ error: `${label} upstream cooling down` }),
        'NONE',
        { 'Retry-After': retryAfter },
      );
    }
    const refresh = coalesceProxyRequest(inFlight, 'global', async () => {
      try {
        const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
        const upstream = await fetch(url, {
          headers: { 'User-Agent': userAgent },
          signal,
        });
        if (upstream.ok) {
          const body = await readResponseTextCapped(
            upstream,
            MIL_MAX_RESPONSE_BYTES,
            signal,
          );
          _cache = body;
          _cacheAt = Date.now();
          _cooldownUntil = 0;
          _cooldownStatus = 0;
          return result(200, body, 'MISS');
        }
        if (upstream.status === 429 || upstream.status >= 500) {
          const failedAt = Date.now();
          _cooldownUntil = failedAt + cooldownFor(upstream, failedAt);
          _cooldownStatus = upstream.status;
          console.warn(
            `[${label} Proxy] upstream ${upstream.status}; cooling down ${Math.round((_cooldownUntil - Date.now()) / 1000)} s${_cache ? ', serving stale' : ''}`,
          );
          if (_cache) {
            // Do not wait for a failing response body before serving usable data.
            upstream.body?.cancel().catch(() => {});
            return result(200, _cache, 'STALE', {
              'X-ADS-B-Upstream-Status': String(upstream.status),
              'X-ADS-B-Retry-After-Seconds': String(
                Math.ceil((_cooldownUntil - Date.now()) / 1000),
              ),
            });
          }
        }
        const body = await readResponseTextCapped(
          upstream,
          MIL_MAX_RESPONSE_BYTES,
          signal,
        );
        return result(
          upstream.status,
          body,
          'MISS',
          _cooldownUntil > Date.now()
            ? {
                'Retry-After': String(
                  Math.ceil((_cooldownUntil - Date.now()) / 1000),
                ),
              }
            : {},
        );
      } catch (e) {
        // A thrown fetch/read (network error, DNS failure, the AbortSignal
        // timing out, a stream error) gets the same stale-or-502 fallback a
        // relayed 5xx gets below — the original single-upstream version let
        // ANY throw here fall through to its outer catch's stale check, so
        // this must cover the whole attempt, not just the fetch() call.
        console.error(`[${label} Proxy]`, e.message);
        if (_cache) return result(200, _cache, 'STALE');
        return result(
          502,
          JSON.stringify({ error: `${label} proxy error` }),
          'NONE',
        );
      }
    });
    return refresh.promise;
  }

  return { get, label };
}

/**
 * Vite plugin: adsb.lol military aircraft proxy with 12 s response cache.
 * Serves GET /api/military from https://api.adsb.lol/v2/mil.
 *
 * Why the non-OK case matters: the browser layer treats a relayed 429 as a
 * 45 s cooldown during which EVERY refresh (the 15 s poll and any tracking
 * resolve) reports "adsb.lol rate limited", which the global status chip
 * renders as LOAD FAILED while the map is still fully populated.
 *
 * @returns {import('vite').Plugin}
 */
export function adsbLolProxy() {
  // adsb.lol is primary (wins on a hex collision, see mergeAircraftByHex) —
  // it is the source this layer shipped with and the one every existing
  // behavior (cache/cooldown semantics, X-Feed-* headers on a single-source
  // response) was written against. adsb.fi is a complementary secondary:
  // same /v2/mil schema, independent feeder network, ~20% non-overlapping
  // aircraft measured live 2026-11-10 (see DATA_SOURCES.md). Each has its
  // OWN cache/cooldown state (createMilSourceFeed instances), so one
  // source's rate limit or outage never affects the other.
  const primaryFeed = createMilSourceFeed({
    url: 'https://api.adsb.lol/v2/mil',
    label: 'adsb.lol',
    userAgent: 'gods-eye-view-adsblol-proxy/1.0',
  });
  const secondaryFeed = createMilSourceFeed({
    url: 'https://opendata.adsb.fi/api/v2/mil',
    label: 'adsb.fi',
    userAgent: 'gods-eye-view-adsbfi-proxy/1.0',
  });

  /** Parse a feed's cached/fresh JSON body into `{..., ac: [...]}`, or null if it is not that shape. */
  function parseAircraftPayload(body) {
    try {
      const parsed = JSON.parse(body);
      return parsed && Array.isArray(parsed.ac) ? parsed : null;
    } catch {
      return null;
    }
  }

  function serve(res, { status, body, cacheStatus, source, extra = {}, ageMs }) {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Feed-Source': source,
      'X-Feed-Cache': cacheStatus,
      ...(['HIT', 'STALE'].includes(cacheStatus) && ageMs != null
        ? { 'X-Feed-Age-Ms': String(ageMs) }
        : {}),
      ...extra,
    });
    res.end(body);
  }

  const installMiddleware = (server) => {
    server.middlewares.use('/api/military', async (req, res, next) => {
      try {
        // This mount also matches its /track route, served by its own handler.
        if (new URL(req.url || '/', 'http://localhost').pathname !== '/')
          return next();
        const [primarySettled, secondarySettled] = await Promise.allSettled([
          primaryFeed.get(),
          secondaryFeed.get(),
        ]);
        const primary =
          primarySettled.status === 'fulfilled' ? primarySettled.value : null;
        const secondary =
          secondarySettled.status === 'fulfilled'
            ? secondarySettled.value
            : null;
        const primaryUsable = primary?.status === 200;
        const secondaryUsable = secondary?.status === 200;

        if (primaryUsable && secondaryUsable) {
          const primaryPayload = parseAircraftPayload(primary.body);
          const secondaryPayload = parseAircraftPayload(secondary.body);
          if (primaryPayload && secondaryPayload) {
            const merged = {
              ...primaryPayload,
              ac: mergeAircraftByHex(primaryPayload.ac, secondaryPayload.ac),
            };
            serve(res, {
              status: 200,
              body: JSON.stringify(merged),
              cacheStatus: primary.cacheStatus,
              source: `${primary.label}+${secondary.label}`,
              ageMs: primary.ageMs,
            });
            return;
          }
          // One side's cached body was not the expected shape — fall through
          // to whichever single source is still usable, same as if that
          // side had failed outright.
        }
        if (primaryUsable) {
          serve(res, {
            status: 200,
            body: primary.body,
            cacheStatus: primary.cacheStatus,
            source: primary.label,
            extra: primary.extra,
            ageMs: primary.ageMs,
          });
          return;
        }
        if (secondaryUsable) {
          serve(res, {
            status: 200,
            body: secondary.body,
            cacheStatus: secondary.cacheStatus,
            source: secondary.label,
            extra: secondary.extra,
            ageMs: secondary.ageMs,
          });
          return;
        }
        // Neither usable — relay the primary's error (matches the
        // pre-merge single-source behavior most closely), else the
        // secondary's, else a generic 502 if both feeds themselves threw
        // (createMilSourceFeed.get() does not throw by design, but a
        // Promise.allSettled rejection is still handled defensively here).
        const fallback = primary || secondary;
        if (fallback) {
          serve(res, {
            status: fallback.status,
            body: fallback.body,
            cacheStatus: fallback.cacheStatus,
            source: fallback.label,
            extra: fallback.extra,
          });
          return;
        }
        throw (
          (primarySettled.status === 'rejected' && primarySettled.reason) ||
          (secondarySettled.status === 'rejected' && secondarySettled.reason)
        );
      } catch (e) {
        console.error('[Military Proxy]', e?.message || e);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ADS-B proxy error' }));
      }
    });
  };
  return {
    name: 'adsblol-proxy',
    configureServer: installMiddleware,
    configurePreviewServer: installMiddleware,
  };
}
