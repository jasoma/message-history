# message-history

Node.js CLI for reading local iMessage history from `~/Library/Messages/chat.db`.

## Setup

```bash
npm install
```

Reading `chat.db` requires Full Disk Access: System Settings → Privacy & Security →
Full Disk Access → add your terminal app, then restart the terminal.

## Commands

### `list`

List all conversations (1:1 and group) with message counts and last-message dates.

```bash
node bin/cli.js list
```

### `read <handle> [--limit N]`

Print a chronological transcript for the 1:1 conversation matching `<handle>`
(phone number or email substring). `--limit` caps the number of most recent
messages shown (default 100).

```bash
node bin/cli.js read +15551234567
node bin/cli.js read someone@example.com --limit 20
```

### Global options

- `--db-path <path>` — use a chat.db at a non-default location (useful for testing).

## Tests

```bash
npm test
```
