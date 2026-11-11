import test from 'node:test';
import assert from 'node:assert/strict';
import { createVesselState } from './state.js';
import { createRendering } from './rendering.js';
import { VESSEL_AGENCY_STYLES } from '../../data/vesselLabels.js';

const noop = () => {};
function services() {
  return {
    overlay: {
      setOverlayEntries: noop,
      setOverlaySourceVisible: noop,
      clearOverlaySource: noop,
    },
    sprites: { registerSpriteCollection: noop },
    focus: {
      forgetSpriteFocus: noop,
      focusNowMs: (now) => now,
      getFocusTarget: () => null,
      focusPassIsNeeded: () => false,
      advanceSpriteFocus: noop,
      focusAlphaNeedsWrite: () => false,
      spriteFocusAtRest: () => true,
    },
    render: {
      holdContinuousRender: noop,
      releaseContinuousRender: noop,
      governorRequestRender: noop,
    },
  };
}

function setup() {
  const vesselState = createVesselState({ source: {}, services: services() });
  const rendering = createRendering({
    vesselState,
    services: services(),
    parts: { queries: { vesselDatumHeightM: () => 0 } },
    layer: {},
    options: {},
  });
  return rendering;
}

function decodeSvg(dataUrl) {
  const base64 = dataUrl.slice('data:image/svg+xml;base64,'.length);
  return Buffer.from(base64, 'base64').toString('utf8');
}

test('shipIcon uses the China Coast Guard shield shape and color for a "CCG" name', () => {
  const rendering = setup();
  const svg = decodeSvg(rendering.shipIcon({ name: 'CCG5901', type: '' }, false));
  assert.match(svg, /M-10,-12 L10,-12/);
  assert.match(svg, new RegExp(VESSEL_AGENCY_STYLES['china-coast-guard'].css));
});

test('shipIcon uses the Chinese research hexagon shape for a curated name', () => {
  const rendering = setup();
  const svg = decodeSvg(rendering.shipIcon({ name: 'XUE LONG', type: '' }, false));
  assert.match(svg, /M0,-12 L10.39,-6/);
  assert.match(svg, new RegExp(VESSEL_AGENCY_STYLES['china-research'].css));
});

test('shipIcon uses the Japan Coast Guard star shape for a curated name', () => {
  const rendering = setup();
  const svg = decodeSvg(rendering.shipIcon({ name: 'MIZUHO', type: '' }, false));
  assert.match(svg, /M0,-13 L3.06,-4.02/);
  assert.match(svg, new RegExp(VESSEL_AGENCY_STYLES['japan-coast-guard'].css));
});

test('shipIcon falls back to the existing chevron and AIS-type color when no agency matches', () => {
  const rendering = setup();
  const svg = decodeSvg(
    rendering.shipIcon({ name: 'EVER GIVEN', type: 'Cargo' }, false),
  );
  assert.match(svg, /M0,-14 L11,10/);
  assert.match(svg, /#39d5ff/);
});

test('shipIcon still renders selected vessels white regardless of agency match', () => {
  const rendering = setup();
  const svg = decodeSvg(rendering.shipIcon({ name: 'CCG5901', type: '' }, true));
  assert.match(svg, /M-10,-12 L10,-12/);
  assert.match(svg, /#ffffff/);
});
