const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadContacts } = require('../src/contactsCache');

function tempCachePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-contacts-'));
  return path.join(dir, 'contacts-cache.json');
}

test('fetches and writes the cache when no cache file exists', () => {
  const cachePath = tempCachePath();
  const fetched = [{ name: 'Ada Lovelace', emails: [], phones: [] }];
  let fetchCalls = 0;
  const fetchFn = () => {
    fetchCalls += 1;
    return fetched;
  };

  const result = loadContacts({ cachePath, fetchFn, log: () => {} });

  assert.equal(fetchCalls, 1);
  assert.deepEqual(result, fetched);
  assert.deepEqual(JSON.parse(fs.readFileSync(cachePath, 'utf8')), fetched);
});

test('reads from the cache without calling fetchFn when a cache file exists', () => {
  const cachePath = tempCachePath();
  const cached = [{ name: 'Grace Hopper', emails: [], phones: [] }];
  fs.writeFileSync(cachePath, JSON.stringify(cached));
  let fetchCalls = 0;
  const fetchFn = () => {
    fetchCalls += 1;
    return [{ name: 'should not be used', emails: [], phones: [] }];
  };

  const result = loadContacts({ cachePath, fetchFn, log: () => {} });

  assert.equal(fetchCalls, 0);
  assert.deepEqual(result, cached);
});

test('forceRefresh re-fetches and overwrites an existing cache file', () => {
  const cachePath = tempCachePath();
  fs.writeFileSync(cachePath, JSON.stringify([{ name: 'stale', emails: [], phones: [] }]));
  const fresh = [{ name: 'fresh', emails: [], phones: [] }];
  let fetchCalls = 0;
  const fetchFn = () => {
    fetchCalls += 1;
    return fresh;
  };

  const result = loadContacts({ forceRefresh: true, cachePath, fetchFn, log: () => {} });

  assert.equal(fetchCalls, 1);
  assert.deepEqual(result, fresh);
  assert.deepEqual(JSON.parse(fs.readFileSync(cachePath, 'utf8')), fresh);
});

test('logs a wait message when fetching but not when reading from cache', () => {
  const cachePath = tempCachePath();
  const logMessages = [];
  const log = (message) => logMessages.push(message);

  loadContacts({ cachePath, fetchFn: () => [], log });
  assert.equal(logMessages.length, 1);
  assert.match(logMessages[0], /fetching/i);

  logMessages.length = 0;
  loadContacts({ cachePath, fetchFn: () => [], log });
  assert.equal(logMessages.length, 0);
});
