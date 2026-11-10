import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import {
  fleetHighlightColor,
  matchedHighlightKlass,
  countHighlightKlasses,
  armedHighlightKlass,
  MIL_ICON_COLOR,
  EMERGENCY_ICON_COLOR,
  HIGHLIGHT_FASTJET_COLOR,
  HIGHLIGHT_UAV_COLOR,
  HIGHLIGHT_TANKER_COLOR,
} from './policy.js';

test('matchedHighlightKlass: fastjet/uav by klass, tanker by type, others null', () => {
  assert.equal(matchedHighlightKlass({ klass: 'fastjet' }), 'fastjet');
  assert.equal(matchedHighlightKlass({ klass: 'uav' }), 'uav');
  assert.equal(matchedHighlightKlass({ klass: 'widebody', type: 'C17' }), 'tanker');
  assert.equal(matchedHighlightKlass({ klass: 'widebody', type: 'K35R' }), 'tanker');
  // A civilian widebody shares the klass with tankers but is not one.
  assert.equal(matchedHighlightKlass({ klass: 'widebody', type: 'A333' }), null);
  assert.equal(matchedHighlightKlass({ klass: 'airliner' }), null);
  assert.equal(matchedHighlightKlass({}), null);
});

test('countHighlightKlasses: empty fleet is all zero', () => {
  assert.deepEqual(countHighlightKlasses([]), { fastjet: 0, uav: 0, tanker: 0 });
});

test('countHighlightKlasses: tallies a mixed fleet correctly, ignoring non-matches', () => {
  const fleet = [
    { klass: 'fastjet' },
    { klass: 'fastjet' },
    { klass: 'uav' },
    { klass: 'widebody', type: 'C17' },
    { klass: 'widebody', type: 'K35R' },
    { klass: 'widebody', type: 'A333' }, // civilian widebody, not a tanker
    { klass: 'airliner' },
    { klass: 'helicopter' },
  ];
  assert.deepEqual(countHighlightKlasses(fleet), { fastjet: 2, uav: 1, tanker: 2 });
});

test('armedHighlightKlass: null unless both the match AND its own toggle are true', () => {
  assert.equal(armedHighlightKlass({ klass: 'fastjet' }), null);
  assert.equal(
    armedHighlightKlass({ klass: 'fastjet', highlightFastjet: true }),
    'fastjet',
  );
  // Matching a different klass's armed toggle must not cross-trigger.
  assert.equal(
    armedHighlightKlass({ klass: 'fastjet', highlightUav: true }),
    null,
  );
  assert.equal(
    armedHighlightKlass({ klass: 'widebody', type: 'C17', highlightTanker: true }),
    'tanker',
  );
  assert.equal(
    armedHighlightKlass({ klass: 'widebody', type: 'A333', highlightTanker: true }),
    null,
  );
});

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
