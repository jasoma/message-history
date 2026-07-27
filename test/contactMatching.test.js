const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, normalizeEmail, findContactName } = require('../src/contactMatching');

test('normalizePhone strips formatting to digits only', () => {
  assert.equal(normalizePhone('+61 466 211 893'), '61466211893');
});

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  Someone@Example.com  '), 'someone@example.com');
});

test('findContactName matches an email handle case-insensitively', () => {
  const contacts = [{ name: 'Ada Lovelace', emails: ['ada@example.com'], phones: [] }];
  assert.equal(findContactName('Ada@Example.com', contacts), 'Ada Lovelace');
});

test('findContactName matches a phone handle despite differing formatting', () => {
  const contacts = [{ name: 'Grace Hopper', emails: [], phones: ['+61 466 211 893'] }];
  assert.equal(findContactName('+61466211893', contacts), 'Grace Hopper');
});

test('findContactName returns null when nothing matches', () => {
  const contacts = [{ name: 'Ada Lovelace', emails: ['ada@example.com'], phones: [] }];
  assert.equal(findContactName('+15551234567', contacts), null);
});

test('findContactName returns null for an empty contacts list', () => {
  assert.equal(findContactName('+15551234567', []), null);
});
