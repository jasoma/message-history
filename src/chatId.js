function parseChatId(value) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`"${value}" is not a valid chat ID. Use --handle to search by phone/email instead.`);
  }
  return Number(value);
}

module.exports = { parseChatId };
