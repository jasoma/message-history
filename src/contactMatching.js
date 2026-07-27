const PHONE_SUFFIX_LENGTH = 8;

function normalizePhone(phone) {
  return phone.replace(/\D/g, '');
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function phoneSuffix(phone) {
  const digits = normalizePhone(phone);
  return digits.slice(-PHONE_SUFFIX_LENGTH);
}

function findContactName(handle, contacts) {
  if (handle.includes('@')) {
    const normalizedHandle = normalizeEmail(handle);
    const match = contacts.find((contact) => contact.emails.some((email) => normalizeEmail(email) === normalizedHandle));
    return match ? match.name : null;
  }

  const handleSuffix = phoneSuffix(handle);
  const match = contacts.find((contact) => contact.phones.some((phone) => phoneSuffix(phone) === handleSuffix));
  return match ? match.name : null;
}

module.exports = { normalizePhone, normalizeEmail, findContactName };
