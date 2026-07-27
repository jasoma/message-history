# Design: PDF export of a conversation's full message history

**Date:** 2026-07-27
**Status:** Approved, pending implementation

## Goal

A new `export` command that writes a conversation's complete message history
(not capped at 100 like `read`) to a PDF file, the last deferred item from the
original project goal ("enable export of an entire conversation history in PDF
format").

## Decisions made

- Scope: one conversation (by chat ID or handle, like `read`) with its full
  history, not a batch export of every conversation.
- PDF library: `pdfkit` (pure JS, no headless browser dependency).
- Layout: plain chronological transcript — bold "Sender timestamp" header
  line per message, body text below, `moveDown()` between messages. No
  chat-bubble styling for this first pass.
- Fonts: pdfkit's built-in fonts only cover Latin/WinAnsi text. Bundled two
  Unicode font families into `assets/fonts/` instead:
  - `NotoSans-Regular.ttf` / `NotoSans-Bold.ttf` — Latin, Cyrillic, Greek, etc.
  - `NotoSansJP-Regular.ttf` / `NotoSansJP-Bold.ttf` — adds Japanese
    (Hiragana/Katakana/CJK ideographs), chosen because real contact data in
    this project includes Japanese phone numbers/handles.
  - Known gap: Korean and emoji are still unsupported (neither font covers
    them) — accepted rather than bundling a full CJK+emoji font stack, which
    would be tens of MB.
  - Font selection is per text run: a regex checks for
    Hiragana/Katakana/CJK-ideograph/fullwidth-form Unicode ranges; if present,
    use the NotoSansJP variant (which also renders Latin/ASCII fine for mixed
    text), otherwise NotoSans.
- CLI shape: `export <value> [--id|--handle] [--limit N] [-o/--output path]`,
  mirroring `read`'s selector flags (`--id`/`--handle` mutually exclusive,
  `--id` default). Default output filename: `messages-<sanitized value>.pdf`
  in the current directory.
- Memory: unbounded export must not buffer the entire message history in
  memory. See "Streaming architecture" below.

## Streaming architecture

`queries.js` is refactored:

- `mapMessageRow` now always joins `handle` per row (previously the
  handle-lookup path used a fixed fallback value instead of a join). This is
  behaviorally identical for 1:1 chats — every non-"Me" message shares the
  same sender — but removes a special case and lets the bounded and streaming
  paths share one row-mapping function.
- `resolveHandleChatIds(db, handleQuery)` and `getChatMeta(db, chatId)` factor
  out the existing validation/lookup logic (throwing `HandleLookupError` on
  ambiguous/missing matches) so both the bounded and streaming paths share it,
  and so validation runs _before_ any message rows are touched.
- Bounded path (`read`, and `export --limit N`) is unchanged in shape:
  `ORDER BY date DESC LIMIT N` via `.all()`, then `.reverse()`. A capped N is
  always small, so buffering is fine.
- New unbounded path (`export` with no `--limit`): `ORDER BY date ASC` (no
  need for the DESC-then-reverse trick without a LIMIT), read via
  better-sqlite3's `.iterate()` — a lazy cursor, not `.all()` — wrapped in a
  generator (`streamMessagesForHandle`/`streamMessagesForChatId`). These are
  plain functions that eagerly call the resolve/validate helpers (so a bad
  chat ID/handle throws immediately, before any file I/O starts) and then
  return a lazy generator for the row-by-row streaming.

`export`'s PDF title needs chat metadata (display name / participant handles)
up front — a separate query against `chat`/`chat_handle_join`, not `message`,
so it's cheap regardless of history length and doesn't conflict with the
streaming goal.

Messages are lazily transformed to `{date, sender, text}` via a generator that
works identically over either an array (bounded path) or the streaming
generator (unbounded path) — same `for...of` code, no branching downstream.
`exportTranscriptToPdf` iterates that lazily, writing each message to the PDF
document as it goes and counting as it writes, resolving with the final count
when the output file finishes. Nothing holds the full history in memory at
once on the unbounded path.

## Architecture

```
assets/fonts/
  NotoSans-Regular.ttf / NotoSans-Bold.ttf
  NotoSansJP-Regular.ttf / NotoSansJP-Bold.ttf
src/
  formatDate.js         # extracted from cli.js, shared by terminal + PDF output
  exportFilename.js     # pure: defaultExportFilename(value) -> "messages-<sanitized>.pdf"
  pdfExport.js            # fontFor(text, opts) [pure] + exportTranscriptToPdf(messages, outputPath, opts) [I/O]
  queries.js              # refactored per "Streaming architecture" above
  cli.js                   # new `export` command; withErrorHandling updated to support async actions
```

## Error handling

Same `HandleLookupError` messages as `read`, surfaced through the same
`withErrorHandling` wrapper — updated to handle async actions (PDF writing is
async) by wrapping the action call in `Promise.resolve().then(...).catch(...)`
instead of a synchronous `try/catch`, so both sync (`list`/`read`) and async
(`export`) actions work through one code path.

## Testing

- `exportFilename.js` (pure) and `pdfExport.js`'s `fontFor` (pure, regex-based
  script detection): full TDD, unit tested.
- The `queries.js` streaming refactor and `exportTranscriptToPdf`'s actual PDF
  generation: manually verified against the real `chat.db` (consistent with
  how `db.js`/`queries.js`/`contacts.js` are already tested in this project) —
  confirm a valid non-empty PDF is produced, confirm memory stays flat on a
  large real conversation, confirm Japanese text renders.
