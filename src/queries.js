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

function resolveHandleChatIds(db, handleQuery) {
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

  const [{ handleId }] = handles;
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

  return chats.map((c) => c.chatId);
}

function getChatMeta(db, chatId) {
  const chat = db.prepare(`SELECT ROWID as chatId, display_name as displayName FROM chat WHERE ROWID = ?`).get(chatId);
  if (!chat) {
    throw new HandleLookupError(`No chat found with id ${chatId}. Run "list" to see known conversations.`);
  }

  const handles = db
    .prepare(
      `SELECT h.id as handle
       FROM chat_handle_join chj
       JOIN handle h ON h.ROWID = chj.handle_id
       WHERE chj.chat_id = ?`
    )
    .all(chatId)
    .map((row) => row.handle);

  return { displayName: chat.displayName, handles };
}

function getMessagesForHandle(db, handleQuery, { limit = DEFAULT_READ_LIMIT } = {}) {
  const chatIds = resolveHandleChatIds(db, handleQuery);
  const rows = selectMessagesForChatIds(db, chatIds, limit);
  return rows.map(mapMessageRow).reverse();
}

function getMessagesForChatId(db, chatId, { limit = DEFAULT_READ_LIMIT } = {}) {
  getChatMeta(db, chatId);
  const rows = selectMessagesForChatIds(db, [chatId], limit);
  return rows.map(mapMessageRow).reverse();
}

// Unbounded streaming variants for full-history export: validate/resolve
// eagerly (so a bad handle/chat id throws immediately, before any file I/O
// starts), then return a lazy generator so the whole history never has to be
// held in memory at once, unlike the bounded .all()-based functions above.
function streamMessagesForHandle(db, handleQuery) {
  const chatIds = resolveHandleChatIds(db, handleQuery);
  return iterateMessagesForChatIds(db, chatIds);
}

function streamMessagesForChatId(db, chatId) {
  getChatMeta(db, chatId);
  return iterateMessagesForChatIds(db, [chatId]);
}

const MESSAGE_ROW_COLUMNS = `m.date as appleDate, m.text as text, m.attributedBody as attributedBody, m.is_from_me as isFromMe, h.id as senderHandle`;
const MESSAGE_ROW_JOINS = `JOIN chat_message_join cmj ON cmj.message_id = m.ROWID LEFT JOIN handle h ON h.ROWID = m.handle_id`;

function selectMessagesForChatIds(db, chatIds, limit) {
  const placeholders = chatIds.map(() => '?').join(', ');
  return db
    .prepare(
      `SELECT ${MESSAGE_ROW_COLUMNS}
       FROM message m
       ${MESSAGE_ROW_JOINS}
       WHERE cmj.chat_id IN (${placeholders})
       ORDER BY m.date DESC
       LIMIT ?`
    )
    .all(...chatIds, limit);
}

function* iterateMessagesForChatIds(db, chatIds) {
  const placeholders = chatIds.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT ${MESSAGE_ROW_COLUMNS}
       FROM message m
       ${MESSAGE_ROW_JOINS}
       WHERE cmj.chat_id IN (${placeholders})
       ORDER BY m.date ASC`
    )
    .iterate(...chatIds);

  for (const row of rows) yield mapMessageRow(row);
}

function mapMessageRow(row) {
  return {
    date: appleTimestampToDate(row.appleDate),
    isFromMe: !!row.isFromMe,
    senderHandle: row.isFromMe ? null : row.senderHandle,
    text: resolveMessageText(row.text, row.attributedBody),
  };
}

function resolveMessageText(text, attributedBody) {
  if (text) return text;
  if (attributedBody) return decodeAttributedBody(attributedBody) || UNREADABLE_PLACEHOLDER;
  return UNREADABLE_PLACEHOLDER;
}

module.exports = {
  listConversations,
  getMessagesForHandle,
  getMessagesForChatId,
  getChatMeta,
  streamMessagesForHandle,
  streamMessagesForChatId,
  HandleLookupError,
};
