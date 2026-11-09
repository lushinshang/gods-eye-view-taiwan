import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMemoryLine } from './memory-monitor.js';

test('69% usage does not warn', () => {
  const { usedPct, warn } = formatMemoryLine(100, 31); // used=69
  assert.equal(Math.round(usedPct), 69);
  assert.equal(warn, false);
});

test('70% usage warns (threshold is inclusive)', () => {
  const { usedPct, warn } = formatMemoryLine(100, 30); // used=70
  assert.equal(usedPct, 70);
  assert.equal(warn, true);
});

test('71% usage warns', () => {
  const { warn } = formatMemoryLine(100, 29);
  assert.equal(warn, true);
});

test('0% usage (all free) does not warn', () => {
  const { usedPct, warn } = formatMemoryLine(100, 100);
  assert.equal(usedPct, 0);
  assert.equal(warn, false);
});

test('100% usage (nothing free) warns', () => {
  const { usedPct, warn } = formatMemoryLine(100, 0);
  assert.equal(usedPct, 100);
  assert.equal(warn, true);
});

test('custom threshold is honored', () => {
  assert.equal(formatMemoryLine(100, 50, 50).warn, true); // 50% used, 50% threshold
  assert.equal(formatMemoryLine(100, 51, 50).warn, false); // 49% used
});

test('line contains GiB figures and percentage', () => {
  const { line } = formatMemoryLine(8 * 1024 ** 3, 2 * 1024 ** 3); // 8GiB total, 2GiB free -> 6GiB used, 75%
  assert.match(line, /8\.0 GiB/);
  assert.match(line, /6\.0 GiB/);
  assert.match(line, /75\.0%/);
});
