import test from 'node:test';
import assert from 'node:assert/strict';
import { createCards } from './cards.js';
import { VESSEL_AGENCY_STYLES } from '../../data/vesselLabels.js';
import { setLocale } from '../../i18n/index.js';

test.before(() => setLocale('zh-Hant'));
test.after(() => setLocale('en'));

const noop = () => {};
function setup() {
  const visual = { position: { x: 0, y: 0, z: 0 } };
  const cards = createCards({
    vesselState: {},
    services: { readouts: { presentSelectedVessel: noop } },
    parts: {
      rendering: {
        getVisual: () => visual,
        labelPriority: () => 0,
      },
    },
    layer: {},
    options: {},
  });
  return cards;
}

const baseRecord = {
  mmsi: '123456789',
  name: 'EVER GIVEN',
  type: 'Cargo',
  speed: 10,
  course: 90,
  destination: '',
  missedRefreshes: 0,
};

test('buildVesselCard title is unchanged and accent is type-based when no agency matches', () => {
  const cards = setup();
  const card = cards.buildVesselCard(baseRecord);
  assert.equal(card.title, 'EVER GIVEN');
  assert.equal(card.accent, '57, 213, 255');
});

test('buildVesselCard prefixes a guessed China Coast Guard label and uses the agency accent', () => {
  const cards = setup();
  const card = cards.buildVesselCard({ ...baseRecord, name: 'CCG5901' });
  assert.match(card.title, /^〔推測:中國海警〕/);
  assert.equal(card.accent, VESSEL_AGENCY_STYLES['china-coast-guard'].accent);
});

test('buildVesselCard prefixes a guessed China research vessel label', () => {
  const cards = setup();
  const card = cards.buildVesselCard({ ...baseRecord, name: 'XUE LONG' });
  assert.match(card.title, /^〔推測:中國科考船〕/);
  assert.equal(card.accent, VESSEL_AGENCY_STYLES['china-research'].accent);
});

test('buildVesselCard prefixes a guessed Japan Coast Guard label', () => {
  const cards = setup();
  const card = cards.buildVesselCard({ ...baseRecord, name: 'MIZUHO' });
  assert.match(card.title, /^〔推測:日本海保〕/);
  assert.equal(card.accent, VESSEL_AGENCY_STYLES['japan-coast-guard'].accent);
});

test('buildSelectedVesselCard also prefixes the guess label, title unchanged when unmatched', () => {
  const cards = setup();
  const plain = cards.buildSelectedVesselCard(baseRecord);
  assert.equal(plain.title, 'EVER GIVEN');
  const matched = cards.buildSelectedVesselCard({
    ...baseRecord,
    name: 'CCG5901',
  });
  assert.match(matched.title, /^〔推測:中國海警〕/);
});
