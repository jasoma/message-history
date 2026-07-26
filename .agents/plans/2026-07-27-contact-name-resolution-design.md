# Design: Contact-name resolution for list/read

**Date:** 2026-07-27
**Status:** Approved, pending implementation

## Goal

Resolve phone numbers/emails shown by `list` and `read` to contact names from
the macOS Contacts app, deferred from the original
`.agents/plans/2026-07-27-messages-read-list-cli-design.md`.

## Decisions made

- Approach: AppleScript via `osascript` subprocess, querying the Contacts app.
  No new native-module dependency, reuses macOS's existing automation
  permission model (separate from the Full Disk Access already required for
  `chat.db`). Rejected alternatives: a native contacts npm package (adds a
  native dependency + its own permission prompt) and reading the AddressBook
  SQLite DB directly (fragile/undocumented schema, multiple source DBs to
  merge).
- Fetch strategy: **one** `osascript` call per CLI invocation that dumps all
  Contacts (name + emails + phones), not one call per handle — `osascript`
  startup overhead is real and `list` can have dozens of handles across many
  chats.
- Matching: done in plain JS after the bulk fetch, not inside AppleScript.
  Phone numbers are normalized to digits-only and compared by their last 8
  digits (tolerates formatting and country-code-prefix differences between
  Contacts and chat.db, e.g. `+61 466 211 893` vs `+61466211893`). Emails are
  compared case-insensitively after trimming.
- Behavior: **always on** (not an opt-in flag) for both `list` and `read`.
- Display format: `Name (handle)` when resolved, falling back to the bare
  handle when no contact matches.
- Failure mode: soft failure. If the Contacts fetch fails (permission denied,
  osascript unavailable, etc.), print a one-line warning to stderr and fall
  back to bare handles rather than failing the whole command — contact-name
  resolution is an enrichment on top of the core chat.db reading
  functionality, not a hard dependency of it.

## Architecture

```
src/
  contacts.js            # I/O: one osascript subprocess call -> [{ name, emails, phones }]
  contactMatching.js     # pure: normalizePhone, normalizeEmail, findContactName(handle, contacts)
```

## `contacts.js`

Runs an embedded AppleScript (as a single `-e` argument to `osascript`) that
iterates `every person` in Contacts, emitting one line per person to stdout:
fields (`name`, comma-joined `emails`, comma-joined `phones`) separated by the
ASCII Unit Separator (`\x1f`) to avoid collisions with real name/email/phone
text; records separated by newline.

`fetchAllContacts()` parses that output into `[{ name, emails: string[],
phones: string[] }]`.

## `contactMatching.js`

- `normalizePhone(phone)` → strips everything but digits.
- `normalizeEmail(email)` → trim + lowercase.
- `findContactName(handle, contacts)` → if `handle` contains `@`, matches by
  normalized email equality; otherwise matches by the last 8 digits of the
  normalized phone number. Returns the first matching contact's name, or
  `null`.

## CLI integration

Contacts are fetched once per invocation (inside `printList`/`printTranscript`
in `src/cli.js`), then:
- `list`: each conversation's `handles` are mapped through `findContactName`
  before being joined into the `NAME/HANDLE(S)` column (a chat's existing
  `display_name`, i.e. named groups, is left as-is).
- `read`: each message's `senderHandle` is resolved the same way for the
  printed sender label (`Me` is unaffected).

Both render as `Name (handle)` when resolved, bare handle otherwise.

If `fetchAllContacts()` throws, catch it at the point of the call, print
`Warning: couldn't resolve contact names (<reason>); showing raw handles.` to
stderr, and proceed with unresolved (bare-handle) output.

## Testing

- `contactMatching.js`: full TDD, unit tests for `normalizePhone`/
  `normalizeEmail` edge cases and `findContactName` (email match, phone match
  with differing formatting, no match, empty contacts list).
- `contacts.js` and the `list`/`read` display integration: manual verification
  against real Contacts data, consistent with how `db.js`/`queries.js` are
  tested — no mocking of `osascript` or a fixture Contacts DB.
