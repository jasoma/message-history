const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fontFor } = require('../src/pdfExport');

test('fontFor picks NotoSans for plain Latin text', () => {
  assert.equal(fontFor('hey are we still on for saturday'), 'NotoSans-Regular');
});

test('fontFor picks the bold NotoSans variant when bold is requested', () => {
  assert.equal(fontFor('Me', { bold: true }), 'NotoSans-Bold');
});

test('fontFor picks NotoSansJP for text containing hiragana', () => {
  assert.equal(fontFor('こんにちは'), 'NotoSansJP-Regular');
});

test('fontFor picks NotoSansJP for text mixing Japanese and Latin', () => {
  assert.equal(fontFor('Thanks! ありがとう'), 'NotoSansJP-Regular');
});

test('fontFor picks the bold NotoSansJP variant for Japanese text when bold is requested', () => {
  assert.equal(fontFor('田中', { bold: true }), 'NotoSansJP-Bold');
});
