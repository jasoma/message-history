const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const DEFAULT_DB_PATH = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');

function openMessagesDb(dbPath = DEFAULT_DB_PATH) {
  try {
    return new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch (error) {
    if (error.code === 'SQLITE_CANTOPEN' || error.code === 'EPERM') {
      throw new Error(
        `Can't read ${dbPath} — grant Full Disk Access to your terminal app in ` +
          'System Settings → Privacy & Security → Full Disk Access, then restart the terminal.',
        { cause: error },
      );
    }
    throw error;
  }
}

module.exports = { openMessagesDb, DEFAULT_DB_PATH };
