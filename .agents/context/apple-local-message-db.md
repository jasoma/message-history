# Reading iMessage History from macOS SQLite DB

## Database
- **Path:** `~/Library/Messages/chat.db` (SQLite3)
- **Permission:** Process reading it needs Full Disk Access (System Settings → Privacy & Security → Full Disk Access)

## Schema (key tables)
- `message` — text content, timestamps, `is_from_me`, `handle_id`, `cache_roomnames` (group chats), `attributedBody` (blob, used when `text` is NULL)
- `handle` — phone numbers / email addresses (`id` column)
- `chat` — conversation metadata
- `chat_handle_join` — maps chats ↔ handles
- `chat_message_join` — maps chats ↔ messages
- `message_attachment_join` / `attachment` — media files

## Timestamps
`message.date` is nanoseconds since 2001-01-01 (Apple Core Data epoch). Convert to Unix epoch: `message.date / 1000000000 + 978307200`.

## Useful queries

```sql
-- Recent messages with sender
SELECT m.ROWID, datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') as date,
       m.text, h.id as sender, m.is_from_me, m.cache_roomnames
FROM message m
LEFT JOIN handle h ON m.handle_id = h.ROWID
ORDER BY m.date DESC LIMIT 100;

-- Messages from a specific contact
SELECT datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime'), m.text, m.is_from_me
FROM message m
JOIN handle h ON m.handle_id = h.ROWID
WHERE h.id LIKE '%5551234%'
ORDER BY m.date DESC;

-- List all conversations with message counts
SELECT h.id, COUNT(*) as msg_count
FROM message m
JOIN handle h ON m.handle_id = h.ROWID
GROUP BY h.id ORDER BY msg_count DESC;
```

## Notes
- Some messages have `text` as NULL; body is in `attributedBody` (NSAttributedString blob — decode with `attributedBody.decode('utf-8', errors='ignore')` and extract readable text)
- Group chat names are in `chat.display_name`; use `chat_message_join` to get messages per chat
- Python: `sqlite3` stdlib module works; `imessage_reader` pip package also available