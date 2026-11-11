/**
 * Taiwan MOTC MPB AIS Vessel Icon Provider
 *
 * Serves optimized, pre-rendered 48x48 PNG icons for maximum WebGL rendering performance.
 * Eliminates SVG runtime DOM parsing & Base64 decoding, enabling direct GPU Texture Atlas pooling.
 *
 * The 3 agency-classification guess categories (see
 * server/providers/vessels/mpb-taiwan.js's `AGENCY_GUESS_CATEGORIES`) have no
 * pre-rendered PNG asset — they're a guess layered on top of this feed, not
 * one of the 8 official MOTC categories the PNG set was designed for — so
 * they render as a generated SVG data URL instead, sharing the exact same
 * shape/color as the `ais-live-vessels` layer's equivalent icons
 * (`src/data/vesselLabels.js`'s `VESSEL_AGENCY_ICON_SHAPES`/`VESSEL_AGENCY_STYLES`)
 * so the same guess looks the same everywhere in the app.
 */
import {
  VESSEL_AGENCY_ICON_SHAPES,
  VESSEL_AGENCY_STYLES,
} from '../../data/vesselLabels.js';

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

const AGENCY_CATEGORY_KEY_TO_GUESS = Object.freeze({
  china_coast_guard: 'china-coast-guard',
  china_research: 'china-research',
  japan_coast_guard: 'japan-coast-guard',
});

const agencyIconCache = new Map();

function agencySvgIcon(guessKey, selected) {
  const cacheKey = `${guessKey}:${selected ? 'selected' : 'normal'}`;
  if (agencyIconCache.has(cacheKey)) return agencyIconCache.get(cacheKey);
  const cssColor = selected ? '#ffffff' : VESSEL_AGENCY_STYLES[guessKey].css;
  const stroke = selected ? 'rgba(6,26,32,0.95)' : 'rgba(4,18,24,0.9)';
  const strokeWidth = selected ? 1.1 : 0.7;
  const path = VESSEL_AGENCY_ICON_SHAPES[guessKey];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <g transform="translate(16,16)">
      <path d="${path}" fill="${cssColor}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
    </g>
  </svg>`;
  const icon = 'data:image/svg+xml;base64,' + btoa(svg);
  agencyIconCache.set(cacheKey, icon);
  return icon;
}

/**
 * Get an icon for a vessel category: a static pre-rendered PNG URL for one
 * of the 8 official MOTC categories, or a generated SVG data URL for one of
 * the 3 agency-classification guess categories.
 * @param {string} categoryKey - One of the 8 MOTC category keys, or one of
 *   `china_coast_guard`/`china_research`/`japan_coast_guard`.
 * @param {string} _baseColor - Optional fallback (unused in static PNG mode).
 * @param {boolean} selected - Whether this vessel is currently clicked/selected.
 * @returns {string} Icon URL (static PNG path or SVG data URL).
 */
export function getTaiwanVesselIcon(categoryKey, _baseColor, selected = false) {
  const guessKey = AGENCY_CATEGORY_KEY_TO_GUESS[categoryKey];
  if (guessKey) return agencySvgIcon(guessKey, selected);
  const cat = VALID_CATEGORIES.has(categoryKey) ? categoryKey : 'unspecified';
  const suffix = selected ? '_selected.png' : '.png';
  return `/icons/taiwan-vessels/${cat}${suffix}`;
}
