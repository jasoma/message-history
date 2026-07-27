const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleMatchesFilter, nameMatchesFilter, conversationMatchesFilter } = require('../src/listFilter');

test('handleMatchesFilter matches a phone handle via digit-truncated containment', () => {
  assert.equal(handleMatchesFilter('4662118', '+61466211893'), true);
});

test('handleMatchesFilter does not match a phone handle when the filter has no digits', () => {
  assert.equal(handleMatchesFilter('abc', '+15551234567'), false);
});

test('handleMatchesFilter matches an email handle case-insensitively', () => {
  assert.equal(handleMatchesFilter('GMAIL', 'conradomaher@gmail.com'), true);
});

test('handleMatchesFilter does not cross-match an email filter against a phone handle', () => {
  assert.equal(handleMatchesFilter('gmail', '+15551234567'), false);
});

test('nameMatchesFilter is a case-insensitive contains match', () => {
  assert.equal(nameMatchesFilter('maher', 'The Mahers'), true);
});

test('nameMatchesFilter returns false for a null name', () => {
  assert.equal(nameMatchesFilter('maher', null), false);
});

test('conversationMatchesFilter matches on the group display name', () => {
  const conversation = { displayName: 'Family Trip', handles: [] };
  assert.equal(conversationMatchesFilter('trip', conversation, []), true);
});

test('conversationMatchesFilter matches on a raw handle', () => {
  const conversation = { displayName: null, handles: ['+61466211893'] };
  assert.equal(conversationMatchesFilter('4662118', conversation, []), true);
});

test('conversationMatchesFilter matches on a resolved contact name, not just the raw handle', () => {
  const conversation = { displayName: null, handles: ['+61466211893'] };
  const contacts = [{ name: 'John Smith', emails: [], phones: ['+61466211893'] }];
  assert.equal(conversationMatchesFilter('smith', conversation, contacts), true);
});

test('conversationMatchesFilter returns false when nothing matches', () => {
  const conversation = { displayName: null, handles: ['+61466211893'] };
  assert.equal(conversationMatchesFilter('nomatch', conversation, []), false);
});
