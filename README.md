# message-history

Node.js CLI for reading local iMessage history from `~/Library/Messages/chat.db`.

## Setup

```bash
npm install
```

Reading `chat.db` requires Full Disk Access: System Settings → Privacy & Security →
Full Disk Access → add your terminal app, then restart the terminal.

`list` and `read` also resolve handles to Contacts app names. The first run
triggers a macOS permission prompt asking to let your terminal control
Contacts — approve it, or resolution silently falls back to raw handles.
Fetching contacts is slow (several seconds, scaling with your contact count
— inherent to AppleScript's per-property access overhead against the
Contacts app), so results are cached at `~/.message-history/contacts-cache.json`
after the first fetch; every call after that is fast. Pass `--update-contacts`
to refresh the cache (e.g. after adding/editing a contact).

## Commands

### `list`

List all conversations (1:1 and group) with message counts and last-message
dates. Handles are shown as `Name (handle)` when a Contacts match is found,
otherwise the bare handle.

```bash
node bin/cli.js list
```

### `read <value> [--id | --handle] [--limit N]`

Print a chronological transcript for a conversation. `<value>` is interpreted
as a chat ID (from `list`) by default; pass `--handle` to instead match by
phone number/email substring (works for 1:1 conversations only). `--id` and
`--handle` are mutually exclusive. `--limit` caps the number of most recent
messages shown (default 100). Senders are shown as `Name (handle)` when a
Contacts match is found, otherwise the bare handle.

```bash
node bin/cli.js read 42                                  # by chat ID (default)
node bin/cli.js read 42 --id                              # same, explicit
node bin/cli.js read +15551234567 --handle                # by handle
node bin/cli.js read someone@example.com --handle --limit 20
```

### Global options

- `--db-path <path>` — use a chat.db at a non-default location (useful for testing).
- `--update-contacts` — refresh the local contacts cache before running (see above).

## Tests

```bash
npm test
```
