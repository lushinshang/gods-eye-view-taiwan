import test from 'node:test';
import assert from 'node:assert/strict';
import { createTracking } from './tracking.js';

/**
 * _buildTrackedLabel's hexdb.io fallback, exercised the same way
 * ownership.test.mjs's "voice context" test stubs createTracking — only the
 * services/parts this function path actually touches, not a full scene.
 */
function stubServices() {
  return {
    context: {},
    aircraftPresentation: { tr3bTypeLabel: (id, type) => type },
    readout: {},
    groundFloor: {},
    trails: {},
    geoid: {},
    focus: {},
    camera: {},
    picking: {},
  };
}

function stubParts() {
  return {
    queries: {
      _toCleanText: (value) => value || '',
      _formatAltitude: () => '',
    },
  };
}

function freshFlightState() {
  return {
    feed: { _backoff: false },
    records: { data: new Map(), missingPolls: new Map() },
  };
}

test('an aircraft with its own operator never triggers a hexdb.io lookup', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('must not be called');
  };
  try {
    const tracking = createTracking({
      flightState: freshFlightState(),
      services: stubServices(),
      parts: stubParts(),
      layer: {},
    });
    const label = tracking._buildTrackedLabel(
      { callsign: 'RCH123', operator: 'US Air Force' },
      'ae0001',
    );
    assert.ok(label.includes('US Air Force'));
    assert.ok(!label.includes('Unofficial network lookup'));
    await Promise.resolve(); // let any accidental microtask settle
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('an empty operator triggers one hexdb.io lookup; the result appears marked as unofficial on the next build', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.equal(url, '/api/hexdb/ae0001');
    return {
      ok: true,
      json: async () => ({ found: true, owner: 'Republic of China Air Force' }),
    };
  };
  try {
    const tracking = createTracking({
      flightState: freshFlightState(),
      services: stubServices(),
      parts: stubParts(),
      layer: {},
    });
    const first = tracking._buildTrackedLabel({ callsign: 'RCH123' }, 'ae0001');
    assert.ok(first.includes('Operator unknown')); // not yet resolved
    await new Promise((resolve) => setTimeout(resolve, 0));

    const second = tracking._buildTrackedLabel({ callsign: 'RCH123' }, 'ae0001');
    assert.ok(second.includes('Republic of China Air Force'));
    assert.ok(second.includes('Unofficial network lookup'));

    tracking._buildTrackedLabel({ callsign: 'RCH123' }, 'ae0001'); // same contact again
    assert.equal(calls, 1, 'the same icao24 must not be queried twice');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a hex hexdb.io cannot resolve keeps the plain "Operator unknown" fallback, with no error', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ found: false }) };
  };
  try {
    const tracking = createTracking({
      flightState: freshFlightState(),
      services: stubServices(),
      parts: stubParts(),
      layer: {},
    });
    tracking._buildTrackedLabel({ callsign: 'XX11' }, 'aaaaaa');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const label = tracking._buildTrackedLabel({ callsign: 'XX11' }, 'aaaaaa');
    assert.ok(label.includes('Operator unknown'));
    assert.ok(!label.includes('Unofficial network lookup'));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a hexdb.io network failure keeps the plain "Operator unknown" fallback, with no throw', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network down');
  };
  try {
    const tracking = createTracking({
      flightState: freshFlightState(),
      services: stubServices(),
      parts: stubParts(),
      layer: {},
    });
    assert.doesNotThrow(() => {
      tracking._buildTrackedLabel({ callsign: 'XX22' }, 'bbbbbb');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const label = tracking._buildTrackedLabel({ callsign: 'XX22' }, 'bbbbbb');
    assert.ok(label.includes('Operator unknown'));
  } finally {
    globalThis.fetch = realFetch;
  }
});
