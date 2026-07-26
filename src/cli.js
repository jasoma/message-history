const Table = require('cli-table3');
const { Command } = require('commander');
const { openMessagesDb, DEFAULT_DB_PATH } = require('./db');
const { listConversations, getMessagesForHandle } = require('./queries');

const LIST_COLUMN_WIDTHS = { chatId: 9, type: 8, messages: 10, lastMessage: 21 };
const LIST_TABLE_OVERHEAD = 16; // cli-table3 borders + padding for 5 columns
const MIN_NAME_COLUMN_WIDTH = 30;

function formatDate(date) {
  if (!date) return '—';
  return date.toLocaleString('en-US', { hour12: false }).replace(',', '');
}

function printList(db) {
  const conversations = listConversations(db);
  const terminalWidth = process.stdout.columns || 120;
  const fixedWidth = LIST_COLUMN_WIDTHS.chatId + LIST_COLUMN_WIDTHS.type + LIST_COLUMN_WIDTHS.messages + LIST_COLUMN_WIDTHS.lastMessage;
  const nameColumnWidth = Math.max(MIN_NAME_COLUMN_WIDTH, terminalWidth - fixedWidth - LIST_TABLE_OVERHEAD);

  const table = new Table({
    head: ['CHAT ID', 'TYPE', 'NAME/HANDLE(S)', 'MESSAGES', 'LAST MESSAGE'],
    colWidths: [LIST_COLUMN_WIDTHS.chatId, LIST_COLUMN_WIDTHS.type, nameColumnWidth, LIST_COLUMN_WIDTHS.messages, LIST_COLUMN_WIDTHS.lastMessage],
    wordWrap: true,
  });

  for (const c of conversations) {
    table.push([
      c.chatId,
      c.type,
      c.displayName || c.handles.join(', ') || '(unknown)',
      c.messageCount,
      formatDate(c.lastMessageDate),
    ]);
  }

  console.log(table.toString());
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
