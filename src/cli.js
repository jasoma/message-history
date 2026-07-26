const { Command } = require('commander');
const { openMessagesDb, DEFAULT_DB_PATH } = require('./db');
const { listConversations, getMessagesForHandle } = require('./queries');

function formatDate(date) {
  if (!date) return '—';
  return date.toLocaleString('en-US', { hour12: false }).replace(',', '');
}

function printList(db) {
  const conversations = listConversations(db);
  const rows = conversations.map((c) => ({
    'CHAT ID': c.chatId,
    TYPE: c.type,
    'NAME/HANDLE(S)': c.displayName || c.handles.join(', ') || '(unknown)',
    MESSAGES: c.messageCount,
    'LAST MESSAGE': formatDate(c.lastMessageDate),
  }));
  console.table(rows);
}

function printTranscript(db, handle, limit) {
  const messages = getMessagesForHandle(db, handle, { limit });
  for (const message of messages) {
    const sender = message.isFromMe ? 'Me' : handle;
    console.log(`[${formatDate(message.date)}] ${sender}: ${message.text}`);
  }
}

function withErrorHandling(action) {
  return (...args) => {
    try {
      action(...args);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  };
}

function run(argv) {
  const program = new Command();
  program.name('message-history').description('Read local iMessage history from chat.db');
  program.option('--db-path <path>', 'path to chat.db', DEFAULT_DB_PATH);

  program
    .command('list')
    .description('List all conversations with message counts')
    .action(
      withErrorHandling(() => {
        const db = openMessagesDb(program.opts().dbPath);
        printList(db);
      })
    );

  program
    .command('read <handle>')
    .description('Print a chronological transcript for the 1:1 conversation matching <handle>')
    .option('--limit <n>', 'maximum number of most recent messages to show', '100')
    .action(
      withErrorHandling((handle, options) => {
        const db = openMessagesDb(program.opts().dbPath);
        printTranscript(db, handle, Number(options.limit));
      })
    );

  program.parse(argv);
}

module.exports = { run };
