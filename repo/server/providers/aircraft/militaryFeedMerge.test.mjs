import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAircraftByHex } from './militaryFeedMerge.js';

test('both empty: merged is empty', () => {
  assert.deepEqual(mergeAircraftByHex([], []), []);
  assert.deepEqual(mergeAircraftByHex(), []);
});

test('no overlap: union of both, primary first', () => {
  const primary = [{ hex: 'aaa001', flight: 'ONE' }];
  const secondary = [{ hex: 'bbb002', flight: 'TWO' }];
  assert.deepEqual(mergeAircraftByHex(primary, secondary), [
    { hex: 'aaa001', flight: 'ONE' },
    { hex: 'bbb002', flight: 'TWO' },
  ]);
});

test('full overlap by hex: primary record wins whole, never field-mixed', () => {
  const primary = [{ hex: 'aaa001', flight: 'PRIMARY', alt_baro: 1000 }];
  const secondary = [{ hex: 'aaa001', flight: 'SECONDARY', alt_baro: 2000, extra: 'x' }];
  assert.deepEqual(mergeAircraftByHex(primary, secondary), [
    { hex: 'aaa001', flight: 'PRIMARY', alt_baro: 1000 },
  ]);
});

test('hex comparison is case-insensitive', () => {
  const primary = [{ hex: 'AAA001', flight: 'PRIMARY' }];
  const secondary = [{ hex: 'aaa001', flight: 'SECONDARY' }];
  assert.deepEqual(mergeAircraftByHex(primary, secondary), [
    { hex: 'AAA001', flight: 'PRIMARY' },
  ]);
});

test('records with no usable hex are dropped, not crashed on', () => {
  const primary = [{ flight: 'NO_HEX' }, { hex: '', flight: 'EMPTY_HEX' }, { hex: null, flight: 'NULL_HEX' }];
  const secondary = [{ hex: 'bbb002', flight: 'VALID' }];
  assert.deepEqual(mergeAircraftByHex(primary, secondary), [
    { hex: 'bbb002', flight: 'VALID' },
  ]);
});

test('duplicate hexes within the same list are not repeated', () => {
  const primary = [
    { hex: 'aaa001', flight: 'FIRST' },
    { hex: 'aaa001', flight: 'DUPLICATE' },
  ];
  assert.deepEqual(mergeAircraftByHex(primary, []), [
    { hex: 'aaa001', flight: 'FIRST' },
  ]);
});
