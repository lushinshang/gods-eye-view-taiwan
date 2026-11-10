import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adsbdbProxy } from './enrichment.js';

/** Fresh scratch cache path per test — never touches the real .gev-cache. */
async function scratchCachePath() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'gev-adsbdb-test-'));
  return path.join(dir, 'adsbdb.json');
}

function fakeRes() {
  return {
    headersSent: false,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
      this.headersSent = true;
    },
    end(body) {
      this.body = body;
    },
  };
}

function fakeReq(url, remoteAddress = '127.0.0.1') {
  return { url, method: 'GET', socket: { remoteAddress } };
}

async function middlewareFor(options) {
  const plugin = adsbdbProxy(options);
  let middleware;
  plugin.configureServer({
    middlewares: { use(_route, handler) { middleware = handler; } },
  });
  return (url, remoteAddress) => {
    const res = fakeRes();
    return middleware(fakeReq(url, remoteAddress), res).then(() => res);
  };
}

function aircraftResponse(typeCode) {
  return new Response(
    JSON.stringify({ response: { aircraft: { icao_type: typeCode } } }),
    { status: 200 },
  );
}

test('aircraft cache evicts the oldest entry once past its ceiling; the newest survives', async () => {
  const calls = {};
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const hex = url.split('/').pop();
    calls[hex] = (calls[hex] || 0) + 1;
    return aircraftResponse('T');
  };
  try {
    const request = await middlewareFor({
      cacheMaxEntries: 3,
      cachePath: await scratchCachePath(),
    });
    await request('/type/f1f1f1');
    await request('/type/f2f2f2');
    await request('/type/f3f3f3');
    await request('/type/f4f4f4'); // pushes f1f1f1 out

    await request('/type/f4f4f4'); // newest — still cached
    assert.equal(calls.f4f4f4, 1, 'newest entry must be served from cache');

    await request('/type/f1f1f1'); // oldest — evicted, must refetch
    assert.equal(calls.f1f1f1, 2, 'evicted entry must trigger a fresh fetch');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('routes and aircraft stores evict independently — filling one never evicts the other', async () => {
  const calls = {};
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls[url] = (calls[url] || 0) + 1;
    if (url.includes('callsign')) {
      return new Response(
        JSON.stringify({
          response: {
            flightroute: {
              airline: { name: 'X' },
              origin: { iata_code: 'A' },
              destination: { iata_code: 'B' },
            },
          },
        }),
        { status: 200 },
      );
    }
    return aircraftResponse('T');
  };
  try {
    const request = await middlewareFor({
      cacheMaxEntries: 2,
      cachePath: await scratchCachePath(),
    });
    await request('/route/ABC123');
    await request('/type/a1a1a1');
    await request('/type/a2a2a2');
    await request('/type/a3a3a3'); // overflows aircraft (cap 2), not routes

    const before = Object.keys(calls).length;
    await request('/route/ABC123'); // the one route entry must still be cached
    assert.equal(
      Object.keys(calls).length,
      before,
      'overflowing the aircraft store must not evict the unrelated route entry',
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a disk cache file larger than the ceiling is not read back', async () => {
  const cachePath = await scratchCachePath();
  await fsp.writeFile(
    cachePath,
    JSON.stringify({ aircraft: { abc123: { at: Date.now(), data: { typeCode: 'CACHED' } } } }),
  );
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => aircraftResponse('FRESH');
  try {
    const request = await middlewareFor({ cachePath, cacheMaxDiskBytes: 1 });
    const res = await request('/type/abc123');
    assert.deepEqual(JSON.parse(res.body), {
      found: true,
      typeCode: 'FRESH',
      typeName: null,
      registration: null,
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a disk cache file within the ceiling is read back normally', async () => {
  const cachePath = await scratchCachePath();
  await fsp.writeFile(
    cachePath,
    JSON.stringify({ aircraft: { abc123: { at: Date.now(), data: { typeCode: 'CACHED' } } } }),
  );
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('must not hit upstream when a valid cache entry exists');
  };
  try {
    const request = await middlewareFor({
      cachePath,
      cacheMaxDiskBytes: 10 * 1024 * 1024,
    });
    const res = await request('/type/abc123');
    assert.deepEqual(JSON.parse(res.body), { found: true, typeCode: 'CACHED' });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a missing cache file is treated as absent, not as too large', async () => {
  const cachePath = path.join(await fsp.mkdtemp(path.join(os.tmpdir(), 'gev-adsbdb-test-')), 'missing.json');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => aircraftResponse('OK');
  try {
    const request = await middlewareFor({ cachePath, cacheMaxDiskBytes: 1 });
    const res = await request('/type/abc123');
    assert.equal(JSON.parse(res.body).found, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('an existing object-shaped disk cache survives the Map conversion with no lost entries', async () => {
  const cachePath = await scratchCachePath();
  const onDisk = {
    routes: { ABC123: { at: Date.now(), data: { airline: 'X' } } },
    aircraft: {
      aaa111: { at: Date.now(), data: { typeCode: 'A' } },
      bbb222: { at: Date.now(), data: { typeCode: 'B' } },
    },
  };
  await fsp.writeFile(cachePath, JSON.stringify(onDisk));
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('must not hit upstream — every key above is already cached');
  };
  try {
    const request = await middlewareFor({ cachePath });
    const route = await request('/route/ABC123');
    const ac1 = await request('/type/aaa111');
    const ac2 = await request('/type/bbb222');
    assert.equal(JSON.parse(route.body).found, true);
    assert.equal(JSON.parse(ac1.body).typeCode, 'A');
    assert.equal(JSON.parse(ac2.body).typeCode, 'B');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a client past the per-minute cap gets 429; a different client is unaffected', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => aircraftResponse('OK');
  try {
    const request = await middlewareFor({ cachePath: await scratchCachePath() });
    for (let i = 0; i < 90; i += 1) {
      const res = await request(`/type/${String(i).padStart(6, '0')}`, '1.2.3.4');
      assert.notEqual(res.status, 429, `request ${i + 1} should not be rate-limited yet`);
    }
    const limited = await request('/type/999999', '1.2.3.4');
    assert.equal(limited.status, 429);
    assert.deepEqual(JSON.parse(limited.body), { error: 'Rate limit exceeded' });

    const otherClient = await request('/type/aaaaaa', '9.9.9.9');
    assert.notEqual(otherClient.status, 429, 'a different client must have its own quota');
  } finally {
    globalThis.fetch = realFetch;
  }
});
