function formatDate(date) {
  if (!date) return '—';
  return date.toLocaleString('en-US', { hour12: false }).replace(',', '');
}

module.exports = { formatDate };
