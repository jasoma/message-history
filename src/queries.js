const { appleTimestampToDate } = require('./timestamps');
const { decodeAttributedBody } = require('./attributedBody');

const DEFAULT_READ_LIMIT = 100;
const UNREADABLE_PLACEHOLDER = '[unreadable attachment/content]';

class HandleLookupError extends Error {}

function listConversations(db) {
  const chats = db
    .prepare(
      `SELECT
         c.ROWID as chatId,
         c.display_name as displayName,
         COUNT(DISTINCT cmj.message_id) as messageCount,
         MAX(m.date) as lastMessageDateRaw
       FROM chat c
       LEFT JOIN chat_message_join cmj ON cmj.chat_id = c.ROWID
       LEFT JOIN message m ON m.ROWID = cmj.message_id
       GROUP BY c.ROWID
       ORDER BY lastMessageDateRaw DESC`
    )
    .all();

  const handleRows = db
    .prepare(
      `SELECT chj.chat_id as chatId, h.id as handle
       FROM chat_handle_join chj
       JOIN handle h ON h.ROWID = chj.handle_id`
    )
    .all();

  const handlesByChat = new Map();
  for (const row of handleRows) {
    if (!handlesByChat.has(row.chatId)) handlesByChat.set(row.chatId, []);
    handlesByChat.get(row.chatId).push(row.handle);
  }

  return chats.map((chat) => {
    const handles = handlesByChat.get(chat.chatId) || [];
    return {
      chatId: chat.chatId,
      // A chat with more than one participant handle is a group chat; this
      // is the only reliable signal available without relying on undocumented
      // chat.style values.
      type: handles.length === 1 ? '1:1' : 'group',
      displayName: chat.displayName,
      handles,
      messageCount: chat.messageCount,
      lastMessageDate: chat.lastMessageDateRaw ? appleTimestampToDate(chat.lastMessageDateRaw) : null,
    };
  });
}

function getMessagesForHandle(db, handleQuery, { limit = DEFAULT_READ_LIMIT } = {}) {
  const handles = db
    .prepare(`SELECT ROWID as handleId, id as handleValue FROM handle WHERE id LIKE ?`)
    .all(`%${handleQuery}%`);

  if (handles.length === 0) {
    throw new HandleLookupError(`No handle matches "${handleQuery}". Run "list" to see known conversations.`);
  }
  if (handles.length > 1) {
    const matches = handles.map((h) => h.handleValue).join(', ');
    throw new HandleLookupError(`"${handleQuery}" matches multiple handles (${matches}). Be more specific.`);
  }

  const [{ handleId, handleValue }] = handles;
  const chats = db
    .prepare(
      `SELECT c.ROWID as chatId
       FROM chat c
       JOIN chat_handle_join chj ON chj.chat_id = c.ROWID
       WHERE chj.handle_id = ?
         AND (SELECT COUNT(*) FROM chat_handle_join chj2 WHERE chj2.chat_id = c.ROWID) = 1`
    )
    .all(handleId);

  if (chats.length === 0) {
    throw new HandleLookupError(`No direct (1:1) conversation found for "${handleQuery}". Run "list" to see known conversations.`);
  }

  const chatIds = chats.map((c) => c.chatId);
  const rows = selectMessagesForChatIds(db, chatIds, limit);

  // A 1:1 chat has exactly one other participant, so every inbound message's
  // sender is known without needing to join against `handle` per row.
  return rows.map((row) => mapMessageRow(row, handleValue)).reverse();
}

function getMessagesForChatId(db, chatId, { limit = DEFAULT_READ_LIMIT } = {}) {
  const chat = db.prepare(`SELECT ROWID as chatId FROM chat WHERE ROWID = ?`).get(chatId);
  if (!chat) {
    throw new HandleLookupError(`No chat found with id ${chatId}. Run "list" to see known conversations.`);
  }

  const rows = selectMessagesForChatIds(db, [chatId], limit, { includeSenderHandle: true });
  return rows.map((row) => mapMessageRow(row, row.senderHandle)).reverse();
}

function selectMessagesForChatIds(db, chatIds, limit, { includeSenderHandle = false } = {}) {
  const placeholders = chatIds.map(() => '?').join(', ');
  const senderHandleColumn = includeSenderHandle ? ', h.id as senderHandle' : '';
  const senderHandleJoin = includeSenderHandle ? 'LEFT JOIN handle h ON h.ROWID = m.handle_id' : '';

  return db
    .prepare(
      `SELECT m.date as appleDate, m.text as text, m.attributedBody as attributedBody, m.is_from_me as isFromMe${senderHandleColumn}
       FROM message m
       JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
       ${senderHandleJoin}
       WHERE cmj.chat_id IN (${placeholders})
       ORDER BY m.date DESC
       LIMIT ?`
    )
    .all(...chatIds, limit);
}

function mapMessageRow(row, senderHandle) {
  return {
    date: appleTimestampToDate(row.appleDate),
    isFromMe: !!row.isFromMe,
    senderHandle: row.isFromMe ? null : senderHandle,
    text: resolveMessageText(row.text, row.attributedBody),
  };
}

function resolveMessageText(text, attributedBody) {
  if (text) return text;
  if (attributedBody) return decodeAttributedBody(attributedBody) || UNREADABLE_PLACEHOLDER;
  return UNREADABLE_PLACEHOLDER;
}

module.exports = { listConversations, getMessagesForHandle, getMessagesForChatId, HandleLookupError };
