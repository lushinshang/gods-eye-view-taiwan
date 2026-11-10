import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYER_STATE_STORAGE_KEY } from './data/layerState.js';
import { FIRST_RUN_SESSION_KEY, FIRST_RUN_STORAGE_KEY } from './firstRunExperience.js';
import {
  DEFAULT_FIRST_RUN_LAYER_IDS,
  applyFirstRunDefaultLayers,
  runFirstRunDefaultLayers,
} from './firstRunDefaultLayers.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, next) => values.set(name, next),
    removeItem: (name) => values.delete(name),
  };
}

function fakeDataManager() {
  const enabled = [];
  return {
    enabled,
    setEnabled: async (layerId, value, options) => {
      enabled.push({ layerId, value, options });
      return true;
    },
  };
}

test('DEFAULT_FIRST_RUN_LAYER_IDS is exactly flights + military, never AIS vessels', () => {
  assert.deepEqual([...DEFAULT_FIRST_RUN_LAYER_IDS], ['flights', 'military']);
});

test('a true first visit (no durable layer state) enables flights and military, durably', async () => {
  const dataManager = fakeDataManager();
  const result = await runFirstRunDefaultLayers({
    dataManager,
    storage: memoryStorage(),
    sessionStorageRef: memoryStorage(),
    location: { search: '' },
  });
  assert.equal(result.applied, true);
  assert.deepEqual(
    dataManager.enabled.map((e) => e.layerId).sort(),
    ['flights', 'military'],
  );
  for (const entry of dataManager.enabled) {
    assert.equal(entry.value, true);
    assert.deepEqual(entry.options, { origin: 'user' });
  }
});

test('a returning browser with saved layer state is never touched, even if the saved state turned these layers off', async () => {
  const dataManager = fakeDataManager();
  const result = await runFirstRunDefaultLayers({
    dataManager,
    storage: memoryStorage({ [LAYER_STATE_STORAGE_KEY]: '{"some":"saved-state"}' }),
    sessionStorageRef: memoryStorage(),
    location: { search: '' },
  });
  assert.equal(result.applied, false);
  assert.deepEqual(dataManager.enabled, []);
});

test('a shared link is skipped, like the old launcher skipped it', async () => {
  const dataManager = fakeDataManager();
  const styleManager = { hasShareState: true };
  const result = await runFirstRunDefaultLayers({
    dataManager,
    styleManager,
    storage: memoryStorage(),
    sessionStorageRef: memoryStorage(),
    location: { search: '' },
  });
  assert.equal(result.applied, false);
  assert.deepEqual(dataManager.enabled, []);
});

test('?welcome=0 is skipped, like the old launcher skipped it', async () => {
  const dataManager = fakeDataManager();
  const result = await runFirstRunDefaultLayers({
    dataManager,
    storage: memoryStorage(),
    sessionStorageRef: memoryStorage(),
    location: { search: '?welcome=0' },
  });
  assert.equal(result.applied, false);
  assert.deepEqual(dataManager.enabled, []);
});

test('an embedded globe is skipped, like the old launcher skipped it', async () => {
  const dataManager = fakeDataManager();
  const result = await runFirstRunDefaultLayers({
    dataManager,
    storage: memoryStorage(),
    sessionStorageRef: memoryStorage(),
    location: { search: '?embed=1' },
  });
  assert.equal(result.applied, false);
  assert.deepEqual(dataManager.enabled, []);
});

test('durably-suppressed storage (FIRST_RUN_STORAGE_KEY) is respected', async () => {
  const dataManager = fakeDataManager();
  const result = await runFirstRunDefaultLayers({
    dataManager,
    storage: memoryStorage({ [FIRST_RUN_STORAGE_KEY]: 'suppressed' }),
    sessionStorageRef: memoryStorage(),
    location: { search: '' },
  });
  assert.equal(result.applied, false);
  assert.deepEqual(dataManager.enabled, []);
});

test('session-dismissed storage (FIRST_RUN_SESSION_KEY) is respected', async () => {
  const dataManager = fakeDataManager();
  const result = await runFirstRunDefaultLayers({
    dataManager,
    storage: memoryStorage(),
    sessionStorageRef: memoryStorage({ [FIRST_RUN_SESSION_KEY]: 'dismissed' }),
    location: { search: '' },
  });
  assert.equal(result.applied, false);
  assert.deepEqual(dataManager.enabled, []);
});

test('a setEnabled rejection for one layer does not stop the other from being applied', async () => {
  const enabled = [];
  const dataManager = {
    setEnabled: async (layerId, value, options) => {
      if (layerId === 'flights') throw new Error('boom');
      enabled.push({ layerId, value, options });
      return true;
    },
  };
  const result = await runFirstRunDefaultLayers({
    dataManager,
    storage: memoryStorage(),
    sessionStorageRef: memoryStorage(),
    location: { search: '' },
  });
  assert.equal(result.applied, true);
  assert.deepEqual(enabled, [{ layerId: 'military', value: true, options: { origin: 'user' } }]);
});

test('no dataManager is a safe no-op', async () => {
  const result = await runFirstRunDefaultLayers({
    storage: memoryStorage(),
    sessionStorageRef: memoryStorage(),
    location: { search: '' },
  });
  assert.equal(result.applied, false);
});

// ── Production entry point: synchronous, fire-and-forget, {destroy}|null contract ──

test('applyFirstRunDefaultLayers returns null synchronously (matches the old initFirstRunExperience contract)', () => {
  const dataManager = fakeDataManager();
  const returned = applyFirstRunDefaultLayers({
    dataManager,
    storage: memoryStorage(),
    sessionStorageRef: memoryStorage(),
    location: { search: '' },
  });
  assert.equal(returned, null);
});

test('applyFirstRunDefaultLayers still applies the layers in the background', async (t) => {
  const dataManager = fakeDataManager();
  applyFirstRunDefaultLayers({
    dataManager,
    storage: memoryStorage(),
    sessionStorageRef: memoryStorage(),
    location: { search: '' },
  });
  // Let the fire-and-forget microtask chain settle.
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(dataManager.enabled.map((e) => e.layerId).sort(), ['flights', 'military']);
});

test('applyFirstRunDefaultLayers swallows a rejected runFirstRunDefaultLayers without throwing', () => {
  const dataManager = {
    setEnabled: async () => {
      throw new Error('setEnabled exploded');
    },
  };
  assert.doesNotThrow(() => {
    applyFirstRunDefaultLayers({
      dataManager,
      storage: memoryStorage(),
      sessionStorageRef: memoryStorage(),
      location: { search: '' },
    });
  });
});
