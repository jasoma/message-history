const Table = require('cli-table3');
const { Command } = require('commander');
const { openMessagesDb, DEFAULT_DB_PATH } = require('./db');
const {
  listConversations,
  getMessagesForHandle,
  getMessagesForChatId,
  getChatMeta,
  streamMessagesForHandle,
  streamMessagesForChatId,
} = require('./queries');
const { parseChatId } = require('./chatId');
const { loadContacts } = require('./contactsCache');
const { findContactName } = require('./contactMatching');
const { conversationMatchesFilter } = require('./listFilter');
const { formatDate } = require('./formatDate');
const { defaultExportFilename } = require('./exportFilename');
const { exportTranscriptToPdf } = require('./pdfExport');

const LIST_COLUMN_WIDTHS = { chatId: 9, type: 8, messages: 10, lastMessage: 21 };
const LIST_TABLE_OVERHEAD = 16; // cli-table3 borders + padding for 5 columns
const MIN_NAME_COLUMN_WIDTH = 30;

function fetchContactsOrWarn(forceRefresh) {
  try {
    return loadContacts({ forceRefresh });
  } catch (error) {
    console.error(`Warning: couldn't resolve contact names (${error.message}); showing raw handles.`);
    return [];
  }
}

function formatHandleWithName(handle, contacts) {
  const name = findContactName(handle, contacts);
  return name ? `${name} (${handle})` : handle;
}

function printList(db, filter, forceRefreshContacts) {
  const conversations = listConversations(db);
  const contacts = fetchContactsOrWarn(forceRefreshContacts);
  const filtered = filter ? conversations.filter((c) => conversationMatchesFilter(filter, c, contacts)) : conversations;

  if (filter && filtered.length === 0) {
    console.log(`No conversations match "${filter}".`);
    return;
  }

  const terminalWidth = process.stdout.columns || 120;
  const fixedWidth = LIST_COLUMN_WIDTHS.chatId + LIST_COLUMN_WIDTHS.type + LIST_COLUMN_WIDTHS.messages + LIST_COLUMN_WIDTHS.lastMessage;
  const nameColumnWidth = Math.max(MIN_NAME_COLUMN_WIDTH, terminalWidth - fixedWidth - LIST_TABLE_OVERHEAD);

  const table = new Table({
    head: ['CHAT ID', 'TYPE', 'NAME/HANDLE(S)', 'MESSAGES', 'LAST MESSAGE'],
    colWidths: [
      LIST_COLUMN_WIDTHS.chatId,
      LIST_COLUMN_WIDTHS.type,
      nameColumnWidth,
      LIST_COLUMN_WIDTHS.messages,
      LIST_COLUMN_WIDTHS.lastMessage,
    ],
    wordWrap: true,
  });

  for (const c of filtered) {
    const nameOrHandles = c.displayName || c.handles.map((h) => formatHandleWithName(h, contacts)).join(', ') || '(unknown)';
    table.push([c.chatId, c.type, nameOrHandles, c.messageCount, formatDate(c.lastMessageDate)]);
  }

  console.log(table.toString());
}

function printTranscript(messages, forceRefreshContacts) {
  const contacts = fetchContactsOrWarn(forceRefreshContacts);
  for (const message of messages) {
    let sender = 'Unknown';
    if (message.isFromMe) sender = 'Me';
    else if (message.senderHandle) sender = formatHandleWithName(message.senderHandle, contacts);
    console.log(`[${formatDate(message.date)}] ${sender}: ${message.text}`);
  }
}

// Lazily maps a message iterable (array or streaming generator, either is
// fine here) to the {date, sender, text} shape pdfExport needs, without ever
// materializing the whole thing into an array itself.
function* mapMessagesForPdf(messages, contacts) {
  for (const message of messages) {
    let sender = 'Unknown';
    if (message.isFromMe) sender = 'Me';
    else if (message.senderHandle) sender = formatHandleWithName(message.senderHandle, contacts);
    yield { date: message.date, sender, text: message.text };
  }
}

function requireSelector(id, handle) {
  if (id && handle) {
    throw new Error('Specify either a chat ID (positional) or --handle, not both.');
  }
  if (!id && !handle) {
    throw new Error('Specify a chat ID (positional) or --handle <value>.');
  }
}

function withErrorHandling(action) {
  return (...args) =>
    Promise.resolve()
      .then(() => action(...args))
      .catch((error) => {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
      });
}

function run(argv) {
  const program = new Command();
  program.name('message-history').description('Read local iMessage history from chat.db');
  program.option('--db-path <path>', 'path to chat.db', DEFAULT_DB_PATH);
  program.option('--update-contacts', 'refresh the local contacts cache before running', false);

  program
    .command('list [filter]')
    .description('List conversations, optionally filtered by name or handle (case-insensitive contains match)')
    .action(
      withErrorHandling((filter) => {
        const db = openMessagesDb(program.opts().dbPath);
        printList(db, filter, program.opts().updateContacts);
      }),
    );

  program
    .command('read [id]')
    .description('Print a chronological transcript for a conversation, by chat ID (positional) or --handle')
    .option('--handle <value>', 'look up by phone/email substring instead of a chat ID')
    .option('--limit <n>', 'maximum number of most recent messages to show', '100')
    .action(
      withErrorHandling((id, options) => {
        requireSelector(id, options.handle);
        const db = openMessagesDb(program.opts().dbPath);
        const limit = Number(options.limit);
        const messages = options.handle
          ? getMessagesForHandle(db, options.handle, { limit })
          : getMessagesForChatId(db, parseChatId(id), { limit });
        printTranscript(messages, program.opts().updateContacts);
      }),
    );

  program
    .command('export [id]')
    .description("Export a conversation's full message history to a PDF, by chat ID (positional) or --handle")
    .option('--handle <value>', 'look up by phone/email substring instead of a chat ID')
    .option('--limit <n>', 'cap the number of most recent messages exported (default: unlimited)')
    .option('-o, --output <path>', 'output PDF file path (default: ~/Documents/messages-<value>.pdf)')
    .action(
      withErrorHandling(async (id, options) => {
        requireSelector(id, options.handle);
        const db = openMessagesDb(program.opts().dbPath);
        const contacts = fetchContactsOrWarn(program.opts().updateContacts);
        const limit = options.limit ? Number(options.limit) : null;
        const outputPath = options.output || defaultExportFilename(options.handle || id);

        let messages;
        let title;
        if (options.handle) {
          messages = limit ? getMessagesForHandle(db, options.handle, { limit }) : streamMessagesForHandle(db, options.handle);
          title = formatHandleWithName(options.handle, contacts);
        } else {
          const chatId = parseChatId(id);
          const meta = getChatMeta(db, chatId);
          messages = limit ? getMessagesForChatId(db, chatId, { limit }) : streamMessagesForChatId(db, chatId);
          title = meta.displayName || meta.handles.map((h) => formatHandleWithName(h, contacts)).join(', ') || `Chat ${chatId}`;
        }

        const count = await exportTranscriptToPdf(mapMessagesForPdf(messages, contacts), outputPath, { title });
        console.log(`Wrote ${count} messages to ${outputPath}`);
      }),
    );

  program.parse(argv);
}

module.exports = { run };
