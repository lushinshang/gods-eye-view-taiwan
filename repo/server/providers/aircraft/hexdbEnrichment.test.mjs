import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hexdbEnrichmentProxy } from './hexdbEnrichment.js';

/** Fresh scratch cache path per test — never touches the real .gev-cache. */
async function scratchCachePath() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'gev-hexdb-test-'));
  return path.join(dir, 'hexdb.json');
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
  const plugin = hexdbEnrichmentProxy(options);
  let middleware;
  plugin.configureServer({
    middlewares: { use(_route, handler) { middleware = handler; } },
  });
  return (url, remoteAddress) => {
    const res = fakeRes();
    return middleware(fakeReq(url, remoteAddress), res).then(() => res);
  };
}

function ownerResponse(owner) {
  return new Response(JSON.stringify({ RegisteredOwners: owner }), {
    status: 200,
  });
}

function notFoundResponse() {
  return new Response(
    JSON.stringify({ status: '404', error: 'Aircraft not found.' }),
    { status: 404 },
  );
}

test('a found hex returns {found: true, owner}', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ownerResponse('Republic of China Air Force');
  try {
    const request = await middlewareFor({ cachePath: await scratchCachePath() });
    const res = await request('/89910f');
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body), {
      found: true,
      owner: 'Republic of China Air Force',
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a 404 is negatively cached — repeat lookups do not re-hit upstream', async () => {
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return notFoundResponse();
  };
  try {
    const request = await middlewareFor({ cachePath: await scratchCachePath() });
    const res1 = await request('/000000');
    assert.deepEqual(JSON.parse(res1.body), { found: false });
    const res2 = await request('/000000');
    assert.deepEqual(JSON.parse(res2.body), { found: false });
    assert.equal(calls, 1, 'second lookup must hit the negative cache, not upstream');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the owner cache evicts the oldest entry once past its ceiling; the newest survives', async () => {
  const calls = {};
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const hex = url.split('/').pop();
    calls[hex] = (calls[hex] || 0) + 1;
    return ownerResponse('X');
  };
  try {
    const request = await middlewareFor({
      cacheMaxEntries: 3,
      cachePath: await scratchCachePath(),
    });
    await request('/f1f1f1');
    await request('/f2f2f2');
    await request('/f3f3f3');
    await request('/f4f4f4'); // pushes f1f1f1 out

    await request('/f4f4f4'); // newest — still cached
    assert.equal(calls.f4f4f4, 1, 'newest entry must be served from cache');

    await request('/f1f1f1'); // oldest — evicted, must refetch
    assert.equal(calls.f1f1f1, 2, 'evicted entry must trigger a fresh fetch');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a disk cache file larger than the ceiling is not read back', async () => {
  const cachePath = await scratchCachePath();
  await fsp.writeFile(
    cachePath,
    JSON.stringify({ abc123: { at: Date.now(), owner: 'CACHED' } }),
  );
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ownerResponse('FRESH');
  try {
    const request = await middlewareFor({ cachePath, cacheMaxDiskBytes: 1 });
    const res = await request('/abc123');
    assert.deepEqual(JSON.parse(res.body), { found: true, owner: 'FRESH' });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a disk cache file within the ceiling is read back normally', async () => {
  const cachePath = await scratchCachePath();
  await fsp.writeFile(
    cachePath,
    JSON.stringify({ abc123: { at: Date.now(), owner: 'CACHED' } }),
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
    const res = await request('/abc123');
    assert.deepEqual(JSON.parse(res.body), { found: true, owner: 'CACHED' });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a missing cache file is treated as absent, not as too large', async () => {
  const cachePath = path.join(
    await fsp.mkdtemp(path.join(os.tmpdir(), 'gev-hexdb-test-')),
    'missing.json',
  );
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ownerResponse('OK');
  try {
    const request = await middlewareFor({ cachePath, cacheMaxDiskBytes: 1 });
    const res = await request('/abc123');
    assert.equal(JSON.parse(res.body).found, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a client past the per-minute cap gets 429; a different client is unaffected', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ownerResponse('OK');
  try {
    const request = await middlewareFor({ cachePath: await scratchCachePath() });
    for (let i = 0; i < 90; i += 1) {
      const hex = String(i).padStart(6, '0');
      const res = await request(`/${hex}`, '1.2.3.4');
      assert.notEqual(res.status, 429, `request ${i + 1} should not be rate-limited yet`);
    }
    const limited = await request('/999999', '1.2.3.4');
    assert.equal(limited.status, 429);
    assert.deepEqual(JSON.parse(limited.body), { error: 'Rate limit exceeded' });

    const otherClient = await request('/aaaaaa', '9.9.9.9');
    assert.notEqual(otherClient.status, 429, 'a different client must have its own quota');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('an invalid hex is rejected before touching upstream', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('must not hit upstream for an invalid hex');
  };
  try {
    const request = await middlewareFor({ cachePath: await scratchCachePath() });
    const res = await request('/not-a-hex');
    assert.equal(res.status, 400);
  } finally {
    globalThis.fetch = realFetch;
  }
});
