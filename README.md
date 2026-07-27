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

### `read [id] [--handle value] [--limit N]`

Print a chronological transcript for a conversation. Give it either a chat ID
(from `list`) as the positional argument, or `--handle <value>` to instead
match by phone number/email substring (works for 1:1 conversations only) —
exactly one of the two is required. `--limit` caps the number of most recent
messages shown (default 100). Senders are shown as `Name (handle)` when a
Contacts match is found, otherwise the bare handle.

```bash
node bin/cli.js read 42                                        # by chat ID
node bin/cli.js read --handle +15551234567                      # by handle
node bin/cli.js read --handle someone@example.com --limit 20
```

### `export [id] [--handle value] [--limit N] [-o path]`

Export a conversation's full message history (no cap, unlike `read`) to a
PDF file. Selector works the same as `read` (positional chat ID or `--handle
<value>`, exactly one required). `--limit N` caps it like `read` does, if you
don't want the whole history. Default output path:
`~/Documents/messages-<sanitized value>.pdf`; `-o/--output` overrides it.

Text renders with bundled Noto Sans / Noto Sans JP fonts (covers Latin,
Cyrillic, Greek, and Japanese). Korean text and emoji aren't covered by
either bundled font and will render as blank boxes.

```bash
node bin/cli.js export 42
node bin/cli.js export --handle +15551234567 -o ~/Desktop/thread.pdf
```

### Global options

- `--db-path <path>` — use a chat.db at a non-default location (useful for testing).
- `--update-contacts` — refresh the local contacts cache before running (see above).

## Tests

```bash
npm test
```
