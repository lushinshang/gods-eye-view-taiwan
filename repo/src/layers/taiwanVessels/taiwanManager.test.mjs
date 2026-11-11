import test from 'node:test';
import assert from 'node:assert/strict';
import { taiwanVesselsManager } from './taiwanManager.js';

const ALL_11_CATEGORIES = [
  'cargo',
  'tanker',
  'fishing',
  'passenger',
  'highspeed',
  'special_ops',
  'pleasure_craft',
  'unspecified',
  'china_coast_guard',
  'china_research',
  'japan_coast_guard',
];

test('default enabledCategories includes all 11 categories (8 official + 3 agency-guess)', () => {
  assert.equal(taiwanVesselsManager.enabledCategories.size, 11);
  for (const key of ALL_11_CATEGORIES) {
    assert.ok(
      taiwanVesselsManager.enabledCategories.has(key),
      `missing ${key}`,
    );
  }
});

test('recomputeStats counts vessels into the 3 new agency-guess buckets without touching the 8 official ones', () => {
  taiwanVesselsManager.vessels = [
    { mmsi: '1', categoryKey: 'cargo' },
    { mmsi: '2', categoryKey: 'china_coast_guard' },
    { mmsi: '3', categoryKey: 'china_research' },
    { mmsi: '4', categoryKey: 'japan_coast_guard' },
    { mmsi: '5', categoryKey: 'china_coast_guard' },
    { mmsi: '6', categoryKey: 'unknown_future_key' },
  ];
  taiwanVesselsManager.recomputeStats();
  const s = taiwanVesselsManager.stats;
  assert.equal(s.total, 6);
  assert.equal(s.cargo, 1);
  assert.equal(s.china_coast_guard, 2);
  assert.equal(s.china_research, 1);
  assert.equal(s.japan_coast_guard, 1);
  // an unrecognized categoryKey falls into "unspecified", matching the
  // existing fallback behavior for the 8 official categories
  assert.equal(s.unspecified, 1);
  taiwanVesselsManager.vessels = [];
});

test('setAllCategories(true) enables all 11 categories, setAllCategories(false) clears all 11', () => {
  taiwanVesselsManager.setAllCategories(false);
  assert.equal(taiwanVesselsManager.enabledCategories.size, 0);
  taiwanVesselsManager.setAllCategories(true);
  assert.equal(taiwanVesselsManager.enabledCategories.size, 11);
  for (const key of ALL_11_CATEGORIES) {
    assert.ok(taiwanVesselsManager.enabledCategories.has(key), key);
  }
});

test('toggleCategory can independently toggle one of the 3 new agency-guess categories', () => {
  taiwanVesselsManager.setAllCategories(true);
  taiwanVesselsManager.toggleCategory('china_coast_guard');
  assert.equal(taiwanVesselsManager.enabledCategories.has('china_coast_guard'), false);
  assert.equal(taiwanVesselsManager.enabledCategories.has('china_research'), true);
  taiwanVesselsManager.toggleCategory('china_coast_guard');
  assert.equal(taiwanVesselsManager.enabledCategories.has('china_coast_guard'), true);
});
