/**
 * Taiwan MOTC MPB AIS Vessel Icon Provider
 *
 * Serves optimized, pre-rendered 48x48 PNG icons for maximum WebGL rendering performance.
 * Eliminates SVG runtime DOM parsing & Base64 decoding, enabling direct GPU Texture Atlas pooling.
 */

const VALID_CATEGORIES = new Set([
  'cargo',
  'tanker',
  'fishing',
  'passenger',
  'highspeed',
  'special_ops',
  'pleasure_craft',
  'unspecified',
]);

/**
 * Get PNG Asset URL for a vessel category icon
 * @param {string} categoryKey - One of the 8 MOTC category keys
 * @param {string} _baseColor - Optional fallback (unused in static PNG mode)
 * @param {boolean} selected - Whether this vessel is currently clicked/selected
 * @returns {string} Static URL path to the pre-rendered PNG icon
 */
export function getTaiwanVesselIcon(categoryKey, _baseColor, selected = false) {
  const cat = VALID_CATEGORIES.has(categoryKey) ? categoryKey : 'unspecified';
  const suffix = selected ? '_selected.png' : '.png';
  return `/icons/taiwan-vessels/${cat}${suffix}`;
}
