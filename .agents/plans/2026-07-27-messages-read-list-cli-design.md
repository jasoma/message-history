# Design: Node.js CLI for reading local iMessage history (list + read POC)

**Date:** 2026-07-27
**Status:** Approved, pending implementation

## Goal

Read-only Node.js CLI for `~/Library/Messages/chat.db`. This session's scope is a
**list + read proof of concept only**. The longer-term goal (not this session) is
exporting an entire conversation history to PDF — the data layer here is kept
separate from output formatting so that goal can reuse it later without changes.

The existing Python library in this space is explicitly out of scope — this is a
fresh Node.js implementation.

Background on the database schema, timestamp conversion, and known quirks
(`attributedBody` blobs) is in `.agents/context/apple-local-message-db.md`.

## Decisions made

- Interface: CLI tool (not a library-only package).
- Feature scope for this session: `list` and `read` only.
- SQLite driver: `better-sqlite3` (synchronous, well-maintained, simple API for
  read-only queries).
- `attributedBody` decoding: in scope now (best-effort), since many messages have
  NULL `text` and this is needed eventually for PDF export anyway.
- Contact name resolution (phone/email → contact name via Contacts app or
  AddressBook DB): explicitly **out of scope this session**. Considered approaches
  for later: AppleScript/`osascript` against Contacts (no new deps, reuses
  automation permissions), a native contacts npm package (e.g.
  `node-mac-contacts`), or reading the AddressBook SQLite DB directly (fragile,
  undocumented schema, multiple source DBs to merge).
- `read` command selects a conversation by handle (phone/email substring match),
  not by chat ID.
- Output format: human-readable chronological transcript text (not JSON).

## Architecture & file layout

```
message-history/
  bin/
    cli.js               # shebang entrypoint, delegates to src/cli.js
  src/
    cli.js                # command definitions (list, read), output formatting
    db.js                  # opens chat.db read-only, resolves path (overridable via --db-path)
    queries.js              # SQL against chat.db: listConversations(), getMessagesForHandle()
    attributedBody.js        # best-effort decoder for NSAttributedString blobs when text is NULL
    timestamps.js             # Apple epoch <-> Unix epoch conversion
  test/
    attributedBody.test.js
    timestamps.test.js
  package.json
```

Dependencies: `better-sqlite3` and `commander` (lightweight arg parsing for two
commands). Everything else is Node stdlib.

`queries.js` returns plain JS objects and knows nothing about output formatting.
`cli.js` owns all formatting/printing. This split means a future PDF renderer can
reuse `queries.js` unchanged and only needs a new renderer alongside the text one.

## Data layer

- **`db.js`**: opens with `new Database(path, { readonly: true, fileMustExist: true })`
  — read-only guards against ever mutating the user's real Messages data. Path
  defaults to `path.join(os.homedir(), 'Library/Messages/chat.db')`, overridable
  via `--db-path` (used for testing against a fixture DB).

- **`timestamps.js`**: `appleTimestampToDate(nanoseconds)` → JS `Date`, implementing
  `/1e9 + 978307200`.

- **`attributedBody.js`**: `decodeAttributedBody(buffer)` — the blob is an
  `NSKeyedArchiver`-ish binary format, not a clean plist. Heuristic: locate the
  `NSString` marker, skip the short type/length header that follows, read forward
  as UTF-8 until a control byte. Returns `null` if no readable text is found
  (caller falls back to a placeholder like `[unreadable attachment/content]`).
  Documented as best-effort; isolated so it can be swapped for a stricter
  typedstream parser later without touching callers.

- **`queries.js`**:
  - `listConversations(db)` → for every `chat`: `ROWID`, `display_name` (null for
    1:1), handle(s) via `chat_handle_join`, message count, most recent message
    date. One row per conversation, 1:1 and group alike.
  - `getMessagesForHandle(db, handleQuery, { limit })` → matches
    `handle.id LIKE '%query%'`; finds the 1:1 chat(s) containing *only* that
    handle (via `chat_handle_join`). Throws a typed error if the match is
    ambiguous (multiple distinct handles) or no 1:1 chat exists — the CLI turns
    this into a helpful message. Returns messages newest-first internally, each
    with resolved text (`text` column or decoded `attributedBody`), `is_from_me`,
    and timestamp.

## CLI layer

**`message-history list`** — table of all conversations:
```
CHAT ID  TYPE    NAME/HANDLE(S)              MESSAGES  LAST MESSAGE
42       1:1     +15551234567                 812      2026-07-26 19:41
17       group   "Family" (3 members)         3,204     2026-07-25 08:02
```
(Group participants shown as raw handles since contact-name resolution is out of
scope this session.)

**`message-history read <handle> [--limit N]`** — chronological transcript,
oldest-first:
```
[2026-07-20 14:03] Me: hey are we still on for saturday
[2026-07-20 14:05] +15551234567: yep! see you then
```
`--limit N` caps to the N most recent messages (default 100) so long threads
don't flood the terminal by default.

Shared formatting helpers: local-timezone timestamp formatting, "Me" label for
`is_from_me`.

## Error handling

- DB missing/unreadable (`EPERM`/`SQLITE_CANTOPEN`) → caught in `db.js`, rethrown
  with: *"Can't read chat.db — grant Full Disk Access to your terminal app in
  System Settings → Privacy & Security → Full Disk Access, then restart the
  terminal."*
- Ambiguous/no-match handle in `read` → clear message plus a suggestion to run
  `list`.
- Uncaught errors in `cli.js` print `error.message` and exit 1 (no raw stack
  traces for expected error types).

## Testing

Only pure functions are unit-tested with `node --test` (no real chat.db needed):
`timestamps.js` conversion, `attributedBody.js` against synthetic buffer
fixtures. `queries.js`/`db.js` are exercised manually against a real (or small
fixture) chat.db — POC scope doesn't warrant DB fixture/mocking infrastructure.
