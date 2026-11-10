/**
 * Merge two /v2/mil aircraft lists (adsb.lol primary, adsb.fi secondary) by
 * `hex`, case-insensitively. A `hex` present in both keeps the PRIMARY
 * record whole — fields are never mixed field-by-field across sources, so a
 * record never ends up with adsb.lol's `flight` next to adsb.fi's `alt_baro`
 * from a different poll moment. `secondary` only contributes hexes primary
 * does not have. A record with no usable `hex` is dropped (it cannot be
 * deduplicated or distinguished from another record with no hex).
 * @param {Array<object>} primary adsb.lol's `ac` array.
 * @param {Array<object>} secondary adsb.fi's `ac` array.
 * @returns {Array<object>} Merged, deduplicated aircraft array.
 */
export function mergeAircraftByHex(primary = [], secondary = []) {
  const seen = new Set();
  const merged = [];
  for (const aircraft of primary) {
    const hex = normalizeHex(aircraft?.hex);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    merged.push(aircraft);
  }
  for (const aircraft of secondary) {
    const hex = normalizeHex(aircraft?.hex);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    merged.push(aircraft);
  }
  return merged;
}

function normalizeHex(hex) {
  return typeof hex === 'string' && hex.trim() ? hex.trim().toLowerCase() : null;
}
