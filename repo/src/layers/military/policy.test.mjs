import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import {
  fleetHighlightColor,
  MIL_ICON_COLOR,
  EMERGENCY_ICON_COLOR,
  HIGHLIGHT_FASTJET_COLOR,
  HIGHLIGHT_UAV_COLOR,
  HIGHLIGHT_TANKER_COLOR,
} from './policy.js';

test('all highlights off: every klass still renders the default amber', () => {
  assert.ok(
    Cesium.Color.equals(
      fleetHighlightColor({ emergency: false, klass: 'fastjet', type: 'F16' }),
      MIL_ICON_COLOR,
    ),
  );
});

test('highlightFastjet on matches klass fastjet only', () => {
  assert.ok(
    Cesium.Color.equals(
      fleetHighlightColor({
        emergency: false,
        klass: 'fastjet',
        highlightFastjet: true,
      }),
      HIGHLIGHT_FASTJET_COLOR,
    ),
  );
  assert.ok(
    Cesium.Color.equals(
      fleetHighlightColor({
        emergency: false,
        klass: 'airliner',
        highlightFastjet: true,
      }),
      MIL_ICON_COLOR,
    ),
  );
});

test('highlightUav on matches klass uav only', () => {
  assert.ok(
    Cesium.Color.equals(
      fleetHighlightColor({ emergency: false, klass: 'uav', highlightUav: true }),
      HIGHLIGHT_UAV_COLOR,
    ),
  );
});

test('highlightTanker on matches type C17/K35R, NOT klass widebody — a civilian widebody never lights up', () => {
  assert.ok(
    Cesium.Color.equals(
      fleetHighlightColor({
        emergency: false,
        klass: 'widebody',
        type: 'C17',
        highlightTanker: true,
      }),
      HIGHLIGHT_TANKER_COLOR,
    ),
  );
  assert.ok(
    Cesium.Color.equals(
      fleetHighlightColor({
        emergency: false,
        klass: 'widebody',
        type: 'K35R',
        highlightTanker: true,
      }),
      HIGHLIGHT_TANKER_COLOR,
    ),
  );
  // An ordinary civilian widebody (e.g. A333) shares the 'widebody' klass
  // with C17/K35R but must NOT light up as a tanker.
  assert.ok(
    Cesium.Color.equals(
      fleetHighlightColor({
        emergency: false,
        klass: 'widebody',
        type: 'A333',
        highlightTanker: true,
      }),
      MIL_ICON_COLOR,
    ),
  );
});

test('emergency outranks every highlight', () => {
  assert.ok(
    Cesium.Color.equals(
      fleetHighlightColor({
        emergency: true,
        klass: 'fastjet',
        highlightFastjet: true,
      }),
      EMERGENCY_ICON_COLOR,
    ),
  );
});
