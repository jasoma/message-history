function defaultExportFilename(value) {
  const sanitized = String(value)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `messages-${sanitized}.pdf`;
}

module.exports = { defaultExportFilename };
