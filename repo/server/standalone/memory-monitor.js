import os from 'node:os';

/**
 * System-wide memory monitor, printed to the terminal — not a defense
 * against any one feature's response size (see SECURITY.md's Deployment
 * model: upstream sources are fixed and operator-trusted, so this is
 * observability, not a request-size cap). High usage can come from
 * anything running on the machine, not just this app.
 */

/** Format one status line from raw byte counts. Pure: no I/O, no `os` calls,
 * so the threshold math is unit-testable without mocking the OS. */
export function formatMemoryLine(totalBytes, freeBytes, thresholdPct = 70) {
  const usedBytes = totalBytes - freeBytes;
  const usedPct = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  const gib = (bytes) => (bytes / 1024 ** 3).toFixed(1);
  const warn = usedPct >= thresholdPct;
  const line = `總記憶體 ${gib(totalBytes)} GiB · 已用 ${gib(usedBytes)} GiB (${usedPct.toFixed(1)}%)`;
  return { usedPct, warn, line };
}

/**
 * Vite plugin: every `intervalMs`, read system memory and print one line.
 * Prints a WARNING line too once usage reaches `thresholdPct`. The timer is
 * `unref()`'d so it never keeps the process alive on its own, matching the
 * existing periodic-flush pattern in server/providers/terrain.js.
 */
function startMonitor(intervalMs, thresholdPct) {
  setInterval(() => {
    const { usedPct, warn, line } = formatMemoryLine(os.totalmem(), os.freemem(), thresholdPct);
    console.log(`[Memory] ${line}`);
    if (warn)
      console.warn(`[Memory] WARNING: 已用記憶體達 ${usedPct.toFixed(1)}%（門檻 ${thresholdPct}%）`);
  }, intervalMs).unref?.();
}

export function memoryMonitorPlugin({ intervalMs = 60_000, thresholdPct = 70 } = {}) {
  return {
    name: 'gev-memory-monitor',
    apply: 'serve',
    configureServer() {
      startMonitor(intervalMs, thresholdPct);
    },
    configurePreviewServer() {
      startMonitor(intervalMs, thresholdPct);
    },
  };
}
