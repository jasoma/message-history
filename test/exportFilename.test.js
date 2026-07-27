const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { defaultExportFilename } = require('../src/exportFilename');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mh-export-'));
}

test('sanitizes a numeric chat id into a filename under the given base dir', () => {
  const baseDir = tempDir();
  assert.equal(defaultExportFilename('42', baseDir), path.join(baseDir, 'messages-42.pdf'));
});

test('sanitizes a phone handle into a filename under the given base dir', () => {
  const baseDir = tempDir();
  assert.equal(defaultExportFilename('+61402898325', baseDir), path.join(baseDir, 'messages-61402898325.pdf'));
});

test('sanitizes an email handle into a filename under the given base dir', () => {
  const baseDir = tempDir();
  assert.equal(defaultExportFilename('someone@example.com', baseDir), path.join(baseDir, 'messages-someone-example-com.pdf'));
});
