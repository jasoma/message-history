const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseChatId } = require('../src/chatId');

test('parses a numeric string into a chat id number', () => {
  assert.equal(parseChatId('42'), 42);
});

test('throws a helpful error for a non-numeric value', () => {
  assert.throws(() => parseChatId('+15551234567'), /not a valid chat ID/);
});

test('throws a helpful error for an empty string', () => {
  assert.throws(() => parseChatId(''), /not a valid chat ID/);
});
