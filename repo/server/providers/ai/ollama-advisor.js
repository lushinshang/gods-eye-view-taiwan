import path from 'node:path';
import fs from 'node:fs';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { admitKeySetupRequest } from '../../../src/keySetupCore.mjs';
import { defaultSourceRoot } from '../common/source-root.js';
import { getTaiwanVessels } from '../vessels/mpb-taiwan.js';
import { getTaiwanTraffic } from '../traffic/taiwan-traffic.js';
import { retrieve } from './retriever.js';
import { buildPrompt } from './prompt.js';
import { runOllama, ollamaStatus } from './ollama-client.js';

const digest = (token) => createHash('sha256').update(token).digest();

/**
 * O_NOFOLLOW on the token file itself only guards the final path component —
 * a symlinked `.gev-cache/ai-advisor/` would still be followed transparently,
 * and a shared-host attacker who controls a writable or differently-owned
 * ancestor directory could redirect it the same way. This product only
 * supports a single-OS-user deployment (documented in SECURITY.md); walk
 * every directory between `file` and `root` and refuse if any of them is a
 * symlink, world-writable, or owned by a different user — each is a sign the
 * deployment has left that supported model. A single lstat here is not a
 * full TOCTOU guard (the directory could still be swapped between this check
 * and the open/write that follows), so this narrows the known parent-chain
 * risk without claiming to close it, and it says nothing about genuine
 * multi-user deployments, which remain unsupported and unverified.
 */
function assertTrustedAncestors(file, root) {
  const uid = process.getuid?.();
  let dir = path.dirname(file);
  while (dir !== root && dir !== path.dirname(dir)) {
    let entry;
    try {
      entry = fs.lstatSync(dir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        dir = path.dirname(dir);
        continue;
      }
      throw error;
    }
    const refuse = (code, message) => {
      const error = new Error(message);
      error.code = code;
      throw error;
    };
    if (entry.isSymbolicLink())
      refuse(
        'GEV_PARENT_SYMLINK',
        'refusing to use a PAT store whose parent directory is a symlink',
      );
    if (uid !== undefined && entry.uid !== uid)
      refuse(
        'GEV_PARENT_UNTRUSTED_OWNER',
        'refusing to use a PAT store whose parent directory is owned by a different user',
      );
    if ((entry.mode & 0o002) !== 0)
      refuse(
        'GEV_PARENT_WORLD_WRITABLE',
        'refusing to use a PAT store whose parent directory is world-writable',
      );
    dir = path.dirname(dir);
  }
}

export function createTokenStore(
  file = path.join(defaultSourceRoot, '.gev-cache/ai-advisor/token.json'),
  { root = defaultSourceRoot } = {},
) {
  const read = () => {
    let fd;
    try {
      assertTrustedAncestors(file, root);
      fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) return null;
      const value = JSON.parse(fs.readFileSync(fd, 'utf8'));
      return /^[a-f0-9]{64}$/.test(value.sha256) ? value : null;
    } catch {
      return null;
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  };
  return {
    status() {
      const saved = read();
      return {
        configured: Boolean(saved),
        fingerprint: saved?.sha256.slice(0, 12) ?? null,
      };
    },
    verify(token) {
      const saved = read();
      const actual = digest(typeof token === 'string' ? token : '');
      const expected = saved
        ? Buffer.from(saved.sha256, 'hex')
        : Buffer.alloc(32);
      return (
        timingSafeEqual(actual, expected) &&
        Boolean(saved) &&
        typeof token === 'string' &&
        /^[a-f0-9]{64}$/.test(token)
      );
    },
    rotate() {
      assertTrustedAncestors(file, root);
      const token = randomBytes(32).toString('hex');
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      const temporary = `${file}.${randomBytes(8).toString('hex')}.tmp`;
      try {
        fs.writeFileSync(
          temporary,
          JSON.stringify({ sha256: digest(token).toString('hex') }),
          { mode: 0o600, flag: 'wx' },
        );
        fs.renameSync(temporary, file);
      } finally {
        try {
          fs.unlinkSync(temporary);
        } catch {}
      }
      return { token, ...this.status() };
    },
    revoke() {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      return this.status();
    },
  };
}
export function isLocalBrowser(req, env = process.env) {
  const gate = admitKeySetupRequest({
    method: req.method,
    remoteAddress: req.socket?.remoteAddress,
    hostHeader: req.headers.host,
    protocol: req.socket?.encrypted ? 'https:' : 'http:',
    origin: req.headers.origin,
    contentType: req.headers['content-type'],
    proxyHeaders: req.headers,
    env,
  });
  if (!gate.ok) return false;
  return (
    req.headers['sec-fetch-site'] === 'same-origin' ||
    (req.method === 'POST' && Boolean(req.headers.origin))
  );
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const cleanup = () => {
      req.removeListener('data', data);
      req.removeListener('end', end);
      req.removeListener('error', failed);
      req.removeListener('aborted', aborted);
    };
    const failed = (error) => {
      cleanup();
      reject(error);
    };
    const aborted = () => failed(new Error('Client disconnected'));
    const data = (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > 16_384) {
        cleanup();
        req.resume();
        reject(Object.assign(new Error('Body too large'), { statusCode: 413 }));
      } else chunks.push(Buffer.from(chunk));
    };
    const end = () => {
      cleanup();
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 }));
      }
    };
    req.on('data', data);
    req.once('end', end);
    req.once('error', failed);
    req.once('aborted', aborted);
  });
}
const reply = (res, code, payload) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};
/** External PATs are read-only: token rotation/revocation is exclusively local. */
export function createAdvisorMiddleware({
  tokenStore = createTokenStore(),
  vesselProvider = getTaiwanVessels,
  trafficProvider = getTaiwanTraffic,
  client = runOllama,
  statusProvider = ollamaStatus,
  env = process.env,
} = {}) {
  return async (req, res, next) => {
    const route = new URL(req.url || '/', 'http://localhost').pathname;
    if (
      ![
        '/api/taiwan-ai-advisor',
        '/api/taiwan-ai-status',
        '/api/taiwan-ai-token',
      ].includes(route)
    )
      return next();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const local = isLocalBrowser(req, env);
    // Browsers must pass exact Origin checks even when they possess a PAT.
    if (req.headers.origin) {
      const authority = `${req.socket?.encrypted ? 'https' : 'http'}://${req.headers.host}`;
      if (req.headers.origin !== authority)
        return reply(res, 403, { error: 'Cross-origin requests refused' });
    }
    const bearer = req.headers.authorization?.match(
      /^Bearer ([a-f0-9]{64})$/,
    )?.[1];
    if (!local && !tokenStore.verify(bearer))
      return reply(res, 401, {
        error: 'Local same-origin browser or valid Bearer PAT required',
      });
    if (route === '/api/taiwan-ai-token' && !local)
      return reply(res, 403, { error: 'Token management is local only' });
    const method =
      route === '/api/taiwan-ai-advisor'
        ? 'POST'
        : route === '/api/taiwan-ai-status'
          ? 'GET'
          : null;
    if (
      (method && req.method !== method) ||
      (!method && !['GET', 'POST', 'DELETE'].includes(req.method))
    ) {
      res.setHeader('Allow', method ?? 'GET, POST, DELETE');
      return reply(res, 405, { error: 'Method not allowed' });
    }
    const controller = new AbortController();
    const disconnect = () => {
      if (!res.writableEnded)
        controller.abort(new Error('Client disconnected'));
    };
    req.once('aborted', disconnect);
    res.once('close', disconnect);
    try {
      if (route === '/api/taiwan-ai-token') {
        if (req.method === 'GET') return reply(res, 200, tokenStore.status());
        // DELETE also requires same-origin Fetch Metadata (checked by local gate).
        if (req.method === 'DELETE')
          return reply(res, 200, tokenStore.revoke());
        if (!String(req.headers['content-type']).startsWith('application/json'))
          return reply(res, 415, { error: 'JSON required' });
        await readBody(req);
        return reply(res, 200, tokenStore.rotate());
      }
      if (route === '/api/taiwan-ai-status') {
        try {
          return reply(
            res,
            200,
            await statusProvider({ signal: controller.signal }),
          );
        } catch {
          return reply(res, 200, {
            connected: false,
            ready: false,
            model: null,
          });
        }
      }
      if (!String(req.headers['content-type']).startsWith('application/json'))
        return reply(res, 415, { error: 'JSON required' });
      const body = await readBody(req);
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        typeof body.query !== 'string' ||
        !body.query.trim() ||
        body.query.length > 2000 ||
        (body.think !== undefined && typeof body.think !== 'boolean')
      )
        return reply(res, 400, {
          error: 'query (1–2000 chars) and boolean think required',
        });
      if (
        body.selected !== undefined &&
        (!body.selected ||
          typeof body.selected !== 'object' ||
          Array.isArray(body.selected))
      )
        return reply(res, 400, { error: 'Invalid selected target' });
      const safeSource = async (provider, empty) => {
        try {
          return await provider();
        } catch {
          return {
            ...empty,
            data_health: { status: 'source_error', ageMs: null },
          };
        }
      };
      const [vessels, traffic] = await Promise.all([
        safeSource(vesselProvider, { rows: [] }),
        safeSource(trafficProvider, { events: [], speeds: [] }),
      ]);
      controller.signal.throwIfAborted();
      // Selected targets supply identifiers/coordinates, never their claimed telemetry.
      const result = retrieve({
        query: body.query,
        selected: body.selected,
        vessels,
        traffic,
      });
      const prompt = buildPrompt(result, body.query);
      const answer = await client(prompt, {
        think: body.think === true,
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      const payload = {
        ...answer,
        data_health: result.data_health,
        summary: result.summary,
        matched_total: result.matched_total,
        flags: result.flags,
        intent: result.intent,
        retrieved_sources: {
          vessels: result.vessels,
          events: result.events,
          speeds: result.speeds,
        },
        citations: {
          vessels: prompt.context.vessels,
          events: prompt.context.events,
          speeds: prompt.context.speeds,
        },
        context_token_upper_bound: prompt.token_upper_bound,
      };
      if (
        body.stream === true ||
        req.headers.accept?.includes('text/event-stream')
      ) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('X-Accel-Buffering', 'no');
        res.write(`event: result\ndata: ${JSON.stringify(payload)}\n\n`);
        res.end('event: done\ndata: {}\n\n');
      } else reply(res, 200, payload);
    } catch (error) {
      if (!controller.signal.aborted && !res.writableEnded)
        reply(res, error.statusCode ?? 500, {
          error: error.statusCode ? error.message : 'Advisor request failed',
        });
    } finally {
      req.removeListener('aborted', disconnect);
      res.removeListener('close', disconnect);
    }
  };
}
export function ollamaAdvisorProxy(options) {
  const middleware = createAdvisorMiddleware(options);
  const install = (server) => {
    server.middlewares.use(middleware); // 不可回傳：Vite 會把回傳函式當 post hook 執行
  };
  return {
    name: 'taiwan-ai-advisor',
    configureServer: install,
    configurePreviewServer: install,
  };
}
