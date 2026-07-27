const { normalizeEmail, normalizePhone, findContactName } = require('./contactMatching');

function handleMatchesFilter(filter, handle) {
  if (handle.includes('@')) {
    const normalizedFilter = normalizeEmail(filter);
    return normalizedFilter.length > 0 && normalizeEmail(handle).includes(normalizedFilter);
  }
  const normalizedFilter = normalizePhone(filter);
  return normalizedFilter.length > 0 && normalizePhone(handle).includes(normalizedFilter);
}

function nameMatchesFilter(filter, name) {
  return !!name && name.toLowerCase().includes(filter.toLowerCase());
}

function conversationMatchesFilter(filter, conversation, contacts) {
  if (nameMatchesFilter(filter, conversation.displayName)) return true;

  return conversation.handles.some(
    (handle) => handleMatchesFilter(filter, handle) || nameMatchesFilter(filter, findContactName(handle, contacts))
  );
}

module.exports = { handleMatchesFilter, nameMatchesFilter, conversationMatchesFilter };
