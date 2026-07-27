const os = require('node:os');
const path = require('node:path');

const DEFAULT_EXPORT_DIR = path.join(os.homedir(), 'Documents');

function defaultExportFilename(value, baseDir = DEFAULT_EXPORT_DIR) {
  const sanitized = String(value)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return path.join(baseDir, `messages-${sanitized}.pdf`);
}

module.exports = { defaultExportFilename, DEFAULT_EXPORT_DIR };
