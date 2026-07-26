const NS_STRING_MARKER = 'NSString';
const HEADER_LENGTH = 5; // bytes between "NSString" and the length byte
const LONG_STRING_MARKER = 0x81;

// Best-effort decoder for the NSKeyedArchiver "streamtyped" blob stored in
// message.attributedBody when message.text is NULL. Not a full unarchiver —
// just locates the first NSString payload and reads its length-prefixed text.
function decodeAttributedBody(buffer) {
  const markerIndex = buffer.indexOf(NS_STRING_MARKER, 0, 'latin1');
  if (markerIndex === -1) {
    return null;
  }

  let cursor = markerIndex + NS_STRING_MARKER.length + HEADER_LENGTH;
  let length = buffer[cursor];

  if (length === LONG_STRING_MARKER) {
    length = buffer.readUInt16LE(cursor + 1);
    cursor += 3;
  } else {
    cursor += 1;
  }

  return buffer.toString('utf8', cursor, cursor + length);
}

module.exports = { decodeAttributedBody };
