/** Cache age is measured from the last successful source refresh, never a retry. */
export function dataHealth(updatedAt, ttlMs, error = false, now = Date.now()) {
  const ageMs =
    Number.isFinite(updatedAt) && updatedAt > 0
      ? Math.max(0, now - updatedAt)
      : null;
  return {
    status: error
      ? ageMs === null
        ? 'source_error'
        : 'stale'
      : ageMs === null
        ? 'source_error'
        : ageMs >= ttlMs
          ? 'stale'
          : 'ok',
    ageMs,
  };
}
export function aisSpeed(value) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value < 102.3
    ? value
    : null;
}
