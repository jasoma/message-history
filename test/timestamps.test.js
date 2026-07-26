const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appleTimestampToDate } = require('../src/timestamps');

test('converts Apple Core Data epoch (0) to 2001-01-01T00:00:00Z', () => {
  const date = appleTimestampToDate(0);
  assert.equal(date.toISOString(), '2001-01-01T00:00:00.000Z');
});

test('converts nanoseconds since Apple epoch to the correct Unix date', () => {
  const appleEpochMs = Date.UTC(2001, 0, 1);
  const targetMs = Date.UTC(2024, 0, 1);
  const nanoseconds = (targetMs - appleEpochMs) * 1_000_000;

  const date = appleTimestampToDate(nanoseconds);

  assert.equal(date.toISOString(), '2024-01-01T00:00:00.000Z');
});
