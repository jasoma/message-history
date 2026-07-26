const { test } = require('node:test');
const assert = require('node:assert/strict');
const { decodeAttributedBody } = require('../src/attributedBody');

const NS_STRING_HEADER = Buffer.from([0x00, 0x84, 0x84, 0x01, 0x2b]);

function buildShortStringBuffer(text) {
  const textBytes = Buffer.from(text, 'utf8');
  return Buffer.concat([
    Buffer.from('NSString', 'ascii'),
    NS_STRING_HEADER,
    Buffer.from([textBytes.length]),
    textBytes,
    Buffer.from([0x86, 0x84]),
  ]);
}

function buildLongStringBuffer(text) {
  const textBytes = Buffer.from(text, 'utf8');
  const lengthBytes = Buffer.alloc(2);
  lengthBytes.writeUInt16LE(textBytes.length, 0);
  return Buffer.concat([
    Buffer.from('NSString', 'ascii'),
    NS_STRING_HEADER,
    Buffer.from([0x81]),
    lengthBytes,
    textBytes,
    Buffer.from([0x86, 0x84]),
  ]);
}

test('decodes a short (< 128 byte) NSString payload', () => {
  const buffer = buildShortStringBuffer('hey are we still on for saturday');
  assert.equal(decodeAttributedBody(buffer), 'hey are we still on for saturday');
});

test('decodes a long (>= 128 byte, 2-byte length prefix) NSString payload', () => {
  const longText = 'a'.repeat(200);
  const buffer = buildLongStringBuffer(longText);
  assert.equal(decodeAttributedBody(buffer), longText);
});

test('returns null when no NSString marker is present', () => {
  const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
  assert.equal(decodeAttributedBody(buffer), null);
});

test('decodes UTF-8 text containing multi-byte characters', () => {
  const buffer = buildShortStringBuffer('café 😀');
  assert.equal(decodeAttributedBody(buffer), 'café 😀');
});
