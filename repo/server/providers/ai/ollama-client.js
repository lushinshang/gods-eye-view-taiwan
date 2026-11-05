import { deterministicBrief } from './prompt.js';
let busy = false; // Shared by every advisor instance in this Node process.
export const inferenceBusy = () => busy;
export function resolveModel(names, requested = 'gemma4:e4b') {
  const choices =
    requested === 'gemma4:e4b'
      ? [requested, 'gemma4:e4b-mlx', 'gemma4:e4b-it-qat']
      : [requested];
  return choices.find((name) => names.includes(name)) ?? null;
}
export async function ollamaStatus({
  baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  model = process.env.OLLAMA_MODEL || 'gemma4:e4b',
  fetchImpl = fetch,
  signal,
} = {}) {
  const response = await fetchImpl(`${baseUrl}/api/tags`, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(3000)])
      : AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error('Ollama tags unavailable');
  const data = await response.json();
  const resolved = resolveModel(
    (data.models ?? []).map((m) => m.name),
    model,
  );
  return {
    connected: true,
    ready: Boolean(resolved),
    model: resolved,
    requested_model: model,
    busy,
  };
}
const ZERO_CLAIM =
  /(?<![\d.])0\s*(?:艘|件)|零\s*(?:艘|件)|沒有船|無船|沒有事故|無事故/;
/** Free-form answers are allowed, but every MMSI, ship name and number must trace back to the prompt data. */
export function validateGrounding(content, prompt) {
  if (typeof content !== 'string' || !content.trim()) return false;
  const { data_health, matched_total, vessels } = prompt.context;
  // (a) never claim absence when a source failed, or when matches exist
  if (ZERO_CLAIM.test(content)) {
    if (
      data_health.vessels.status === 'source_error' ||
      data_health.traffic.status === 'source_error'
    )
      return false;
    if (matched_total.vessels > 0 || matched_total.events > 0) return false;
  }
  // (a2) vessel speed is in knots; reject km/h or 公里 attached to 航速
  if (/航速\s*[:：]?\s*\*{0,2}\s*\d+(?:\.\d+)?\s*(?:km\/h|kmh|公里)/i.test(content))
    return false;
  // (b) MMSI
  const mmsis = new Set(vessels.map((v) => String(v.mmsi)));
  if ((content.match(/\b\d{9}\b/g) ?? []).some((m) => !mmsis.has(m)))
    return false;
  // (c) ship names
  const names = new Set(vessels.map((v) => v.name));
  const plain = content.replace(/[*`]/g, '');
  for (const m of plain.matchAll(/船名[「"：:\s]+([^」"，,、；;\n]+)/g))
    if (!names.has(m[1].trim())) return false;
  // (d) numbers: strip list ordinals and thousands separators, allow prompt/brief numbers and 1..15
  const numbers = (text) => text.match(/\d+(?:\.\d+)?/g) ?? [];
  const allowed = new Set([
    ...numbers(prompt.text),
    ...numbers(deterministicBrief(prompt.context)),
    ...Array.from({ length: 15 }, (_, i) => String(i + 1)),
  ]);
  const body = content
    .replace(/^\s*\d+[.、)）]\s*/gm, '')
    .replace(/(\d),(?=\d{3})/g, '$1');
  if (!numbers(body).every((n) => allowed.has(n))) return false;
  // (d2) counts must be real totals for their unit, not the free 1..15 pass (Top-15 length or event totals are not vessel counts)
  const { summary } = prompt.context;
  const realCounts = {
    艘: new Set(
      [
        matched_total.vessels,
        summary.total_vessels,
        Math.min(vessels.length, 10),
        5,
      ].map(String),
    ),
    件: new Set([matched_total.events, summary.total_events].map(String)),
  };
  for (const m of body.matchAll(/(前\s*)?(\d+)\s*([艘件])/g))
    if (!m[1] && !realCounts[m[3]].has(m[2])) return false;
  return true;
}
/** Buffer NDJSON until grounded. No unverified output (including thinking) leaves the server. */
export async function runOllama(
  prompt,
  {
    baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    model = process.env.OLLAMA_MODEL || 'gemma4:e4b',
    think = false,
    signal,
    fetchImpl = fetch,
  } = {},
) {
  if (busy) throw Object.assign(new Error('Advisor busy'), { statusCode: 429 });
  busy = true;
  const combined = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(90_000)])
    : AbortSignal.timeout(90_000);
  try {
    const status = await ollamaStatus({
      baseUrl,
      model,
      signal: combined,
      fetchImpl,
    });
    if (!status.ready) throw new Error('Configured model unavailable');
    const response = await fetchImpl(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: combined,
      body: JSON.stringify({
        model: status.model,
        messages: prompt.messages,
        think: think === true,
        stream: true,
        options: { temperature: 0, num_predict: think === true ? 2048 : 1024 },
      }),
    });
    if (!response.ok || !response.body)
      throw new Error('Ollama chat unavailable');
    let pending = '',
      content = '',
      bytes = 0,
      done = false,
      doneReason = null;
    const decoder = new TextDecoder();
    const consume = (line) => {
      if (!line.trim()) return;
      const item = JSON.parse(line);
      if (item.error) throw new Error(item.error);
      content += item.message?.content ?? '';
      if (item.done) {
        done = true;
        doneReason = item.done_reason ?? null;
      }
    };
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > 262144) throw new Error('Ollama output too large');
      pending += decoder.decode(chunk, { stream: true });
      let index;
      while ((index = pending.indexOf('\n')) >= 0) {
        consume(pending.slice(0, index));
        pending = pending.slice(index + 1);
      }
    }
    consume(pending + decoder.decode());
    if (!done) throw new Error('Incomplete Ollama stream');
    if (doneReason === 'length' || !validateGrounding(content, prompt))
      return {
        content: deterministicBrief(prompt.context),
        fallback_used: true,
        reason: 'grounding_failed',
        model: status.model,
      };
    return {
      content: content.trim(),
      fallback_used: false,
      model: status.model,
    };
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    return {
      content: deterministicBrief(prompt.context),
      fallback_used: true,
      reason: 'ollama_unavailable',
    };
  } finally {
    busy = false;
  }
}
