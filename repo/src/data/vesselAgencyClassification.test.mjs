import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyVesselAgency } from './vesselAgencyClassification.js';

test('classifyVesselAgency matches China Coast Guard "CCG" + digits names', () => {
  assert.deepEqual(classifyVesselAgency({ name: 'CCG5901' }), {
    category: 'china-coast-guard',
    confidence: 'name-pattern',
  });
  assert.deepEqual(classifyVesselAgency({ name: 'ccg1106' }), {
    category: 'china-coast-guard',
    confidence: 'name-pattern',
  });
  assert.deepEqual(classifyVesselAgency({ name: 'CCG 21543' }), {
    category: 'china-coast-guard',
    confidence: 'name-pattern',
  });
});

test('classifyVesselAgency matches curated Chinese research vessel names', () => {
  assert.deepEqual(classifyVesselAgency({ name: 'XUE LONG' }), {
    category: 'china-research',
    confidence: 'curated-name',
  });
  assert.deepEqual(classifyVesselAgency({ name: '雪龙' }), {
    category: 'china-research',
    confidence: 'curated-name',
  });
  assert.deepEqual(classifyVesselAgency({ name: '  xue long  ' }), {
    category: 'china-research',
    confidence: 'curated-name',
  });
  assert.deepEqual(classifyVesselAgency({ name: 'KE XUE' }), {
    category: 'china-research',
    confidence: 'curated-name',
  });
});

test('classifyVesselAgency matches curated Japan Coast Guard vessel names', () => {
  assert.deepEqual(classifyVesselAgency({ name: 'MIZUHO' }), {
    category: 'japan-coast-guard',
    confidence: 'curated-name',
  });
  assert.deepEqual(classifyVesselAgency({ name: 'akitsushima' }), {
    category: 'japan-coast-guard',
    confidence: 'curated-name',
  });
});

test('classifyVesselAgency returns null for unmatched or missing names', () => {
  assert.equal(classifyVesselAgency({ name: 'EVER GIVEN' }), null);
  assert.equal(classifyVesselAgency({ name: 'CCG LOGISTICS 1' }), null);
  assert.equal(classifyVesselAgency({ name: '' }), null);
  assert.equal(classifyVesselAgency({}), null);
  assert.equal(classifyVesselAgency({ name: 'CCG' }), null);
  assert.equal(classifyVesselAgency({ name: 'CCGX5901' }), null);
});
