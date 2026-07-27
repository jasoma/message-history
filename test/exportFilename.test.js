const { test } = require('node:test');
const assert = require('node:assert/strict');
const { defaultExportFilename } = require('../src/exportFilename');

test('sanitizes a numeric chat id into a filename', () => {
  assert.equal(defaultExportFilename('42'), 'messages-42.pdf');
});

test('sanitizes a phone handle into a filename', () => {
  assert.equal(defaultExportFilename('+61402898325'), 'messages-61402898325.pdf');
});

test('sanitizes an email handle into a filename', () => {
  assert.equal(defaultExportFilename('someone@example.com'), 'messages-someone-example-com.pdf');
});
