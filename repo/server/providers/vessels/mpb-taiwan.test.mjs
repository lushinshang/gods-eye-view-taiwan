import test from 'node:test';
import assert from 'node:assert/strict';
import {
  categorizeShip,
  MOTC_CATEGORIES,
  parseRecordTime,
  normalizeCourse,
  convertTaiwanVesselRows,
} from './mpb-taiwan.js';

test('Record_Time uses UTC+8 for wall clocks and respects explicit ISO offsets', () => {
  const expected = Date.parse('2026-11-04T13:19:00Z');
  for (const input of [
    '2026/11/04 21:19:00',
    '2026-11-04 21:19:00',
    '2026-11-04T21:19:00',
    '2026-11-04T21:19:00+08:00',
    '2026-11-04T13:19:00Z',
  ]) {
    assert.equal(parseRecordTime(input), expected, input);
  }
  assert.equal(parseRecordTime('2026-11-04T13:19:00.123Z'), expected + 123);
  for (const input of [
    'garbage',
    '',
    null,
    undefined,
    123,
    '2026/02/30 12:00:00',
    '2026/11/04 24:00:00',
    '2026/11/04 12:60:00',
    '2026/11/04 12:00:60',
    '2026/13/04 12:00:00',
  ]) {
    assert.equal(parseRecordTime(input), null, String(input));
  }
});

test('COG accepts finite bearings and rejects sentinels and missing values', () => {
  for (const v of [
    360,
    361,
    -1,
    NaN,
    Infinity,
    -Infinity,
    null,
    undefined,
    '45',
    '',
  ])
    assert.equal(normalizeCourse(v), null);
  assert.equal(normalizeCourse(0), 0);
  assert.equal(normalizeCourse(359.9), 359.9);
});

test('conversion retains source type 33, true position timestamps and cleaned course/heading', () => {
  assert.equal(categorizeShip(33), MOTC_CATEGORIES.special_ops);
  assert.equal(categorizeShip(34), MOTC_CATEGORIES.unspecified);
  const feature = (extra = {}) => ({
    geometry: { coordinates: [121.5, 25] },
    properties: {
      MMSI: '416460000',
      ShipName: 'TEST',
      Ship_and_Cargo_Type: 33,
      SOG: 5,
      COG: 360,
      Record_Time: '2026/11/04 21:19:00',
      ...extra,
    },
  });
  const now = Date.parse('2026-11-04T14:00:00Z');
  const [r, fallback, emptyCode, invalidCode] = convertTaiwanVesselRows(
    {
      features: [
        feature(),
        feature({ Record_Time: 'bad', Ship_and_Cargo_Type: '70', COG: 359.9 }),
        feature({ Ship_and_Cargo_Type: '' }),
        feature({ Ship_and_Cargo_Type: Infinity }),
      ],
    },
    now,
  );
  assert.equal(r.categoryKey, 'special_ops');
  assert.equal(r.shipTypeCode, 33);
  assert.equal(r.recordEpochMs, Date.parse('2026-11-04T13:19:00Z'));
  assert.equal(r.last_position_UTC, '2026-11-04T13:19:00.000Z');
  assert.equal(r.last_position_epoch, r.recordEpochMs / 1000);
  assert.equal(r.course, null);
  assert.equal(r.heading, null);
  assert.equal(fallback.shipTypeCode, 70);
  assert.equal(fallback.recordEpochMs, null);
  assert.equal(fallback.last_position_epoch, now / 1000);
  assert.equal(fallback.last_position_UTC, 'bad');
  assert.equal(fallback.course, 359.9);
  assert.equal(emptyCode.shipTypeCode, null);
  assert.equal(invalidCode.shipTypeCode, null);
  assert.deepEqual(
    convertTaiwanVesselRows({
      features: [{ geometry: { coordinates: [NaN, 25] } }],
    }),
    [],
  );
});
