const APPLE_EPOCH_OFFSET_SECONDS = 978307200;

function appleTimestampToDate(nanoseconds) {
  const unixSeconds = nanoseconds / 1_000_000_000 + APPLE_EPOCH_OFFSET_SECONDS;
  return new Date(unixSeconds * 1000);
}

module.exports = { appleTimestampToDate };
