import assert from 'node:assert/strict';
import test from 'node:test';
import { copyNewToken } from './tokenReveal.js';

test('clipboard write succeeds: copied, never revealed', async () => {
  const calls = [];
  const result = await copyNewToken('abc123', {
    clipboard: { writeText: async (text) => calls.push(text) },
  });
  assert.deepEqual(result, { copied: true, revealed: false });
  assert.deepEqual(calls, ['abc123']);
});

test('clipboard write throws: falls back to revealed', async () => {
  const result = await copyNewToken('abc123', {
    clipboard: { writeText: async () => { throw new Error('denied'); } },
  });
  assert.deepEqual(result, { copied: false, revealed: true });
});

test('no clipboard available: falls back to revealed, does not throw', async () => {
  const result = await copyNewToken('abc123', { clipboard: undefined });
  assert.deepEqual(result, { copied: false, revealed: true });
});

test('clipboard object without writeText: falls back to revealed', async () => {
  const result = await copyNewToken('abc123', { clipboard: {} });
  assert.deepEqual(result, { copied: false, revealed: true });
});
