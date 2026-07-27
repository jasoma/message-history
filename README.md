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

### `list [filter]`

List conversations (1:1 and group) with message counts and last-message
dates. Handles are shown as `Name (handle)` when a Contacts match is found,
otherwise the bare handle.

Pass `[filter]` to only show conversations matching it — a case-insensitive
contains match against group names and contact names, and a formatting-tolerant
digit/email match against handles (e.g. `4032` matches `+61402898325`,
`gmail` matches `someone@gmail.com`).

```bash
node bin/cli.js list
node bin/cli.js list tani
node bin/cli.js list 4032
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

### `export <value> [--id | --handle] [--limit N] [-o path]`

Export a conversation's full message history (no cap, unlike `read`) to a
PDF file. Selector flags work the same as `read`. `--limit N` caps it like
`read` does, if you don't want the whole history. Default output path:
`~/Documents/messages-<sanitized value>.pdf`; `-o/--output` overrides it.

Text renders with bundled Noto Sans / Noto Sans JP fonts (covers Latin,
Cyrillic, Greek, and Japanese). Korean text and emoji aren't covered by
either bundled font and will render as blank boxes.

```bash
node bin/cli.js export 42
node bin/cli.js export +15551234567 --handle -o ~/Desktop/thread.pdf
```

### Global options

- `--db-path <path>` — use a chat.db at a non-default location (useful for testing).
- `--update-contacts` — refresh the local contacts cache before running (see above).

## Tests

```bash
npm test
```
