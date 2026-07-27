const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fetchAllContacts } = require('./contacts');

const DEFAULT_CACHE_PATH = path.join(os.homedir(), '.message-history', 'contacts-cache.json');

function loadContacts({ forceRefresh = false, cachePath = DEFAULT_CACHE_PATH, fetchFn = fetchAllContacts, log = console.error } = {}) {
  if (!forceRefresh && fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }

  log('Fetching contacts from the Contacts app (this can take a while) — please wait...');
  const contacts = fetchFn();
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(contacts));
  return contacts;
}

module.exports = { loadContacts, DEFAULT_CACHE_PATH };
