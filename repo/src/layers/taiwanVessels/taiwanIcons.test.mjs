import test from 'node:test';
import assert from 'node:assert/strict';
import { getTaiwanVesselIcon } from './taiwanIcons.js';

function decodeSvg(dataUrl) {
  const base64 = dataUrl.slice('data:image/svg+xml;base64,'.length);
  return Buffer.from(base64, 'base64').toString('utf8');
}

test('getTaiwanVesselIcon returns the existing static PNG path for the 8 official MOTC categories', () => {
  assert.equal(
    getTaiwanVesselIcon('cargo', '#39d5ff', false),
    '/icons/taiwan-vessels/cargo.png',
  );
  assert.equal(
    getTaiwanVesselIcon('tanker', '#ff4d4f', true),
    '/icons/taiwan-vessels/tanker_selected.png',
  );
  assert.equal(
    getTaiwanVesselIcon('unknown-garbage', '#000', false),
    '/icons/taiwan-vessels/unspecified.png',
  );
});

test('getTaiwanVesselIcon generates a shield SVG for china_coast_guard', () => {
  const svg = decodeSvg(getTaiwanVesselIcon('china_coast_guard', null, false));
  assert.match(svg, /M-10,-12 L10,-12/);
  assert.match(svg, /#ff3b3b/);
});

test('getTaiwanVesselIcon generates a hexagon SVG for china_research', () => {
  const svg = decodeSvg(getTaiwanVesselIcon('china_research', null, false));
  assert.match(svg, /M0,-12 L10.39,-6/);
  assert.match(svg, /#ffd23b/);
});

test('getTaiwanVesselIcon generates a star SVG for japan_coast_guard, white when selected', () => {
  const normal = decodeSvg(getTaiwanVesselIcon('japan_coast_guard', null, false));
  assert.match(normal, /M0,-13 L3.06,-4.02/);
  assert.match(normal, /#3b7bff/);
  const selected = decodeSvg(getTaiwanVesselIcon('japan_coast_guard', null, true));
  assert.match(selected, /#ffffff/);
});
