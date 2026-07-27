const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');
const { formatDate } = require('./formatDate');

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const JAPANESE_PATTERN = /[\u3000-\u303F\u3040-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/;

function fontFor(text, { bold = false } = {}) {
  const isJapanese = JAPANESE_PATTERN.test(text);
  if (isJapanese) return bold ? 'NotoSansJP-Bold' : 'NotoSansJP-Regular';
  return bold ? 'NotoSans-Bold' : 'NotoSans-Regular';
}

function registerFonts(doc) {
  doc.registerFont('NotoSans-Regular', path.join(FONT_DIR, 'NotoSans-Regular.ttf'));
  doc.registerFont('NotoSans-Bold', path.join(FONT_DIR, 'NotoSans-Bold.ttf'));
  doc.registerFont('NotoSansJP-Regular', path.join(FONT_DIR, 'NotoSansJP-Regular.ttf'));
  doc.registerFont('NotoSansJP-Bold', path.join(FONT_DIR, 'NotoSansJP-Bold.ttf'));
}

// messages: an iterable (array or generator) of { date, sender, text }, consumed lazily
// so an unbounded/streaming source never gets buffered into memory here.
function exportTranscriptToPdf(messages, outputPath, { title } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    registerFonts(doc);

    if (title) {
      doc.font(fontFor(title, { bold: true })).fontSize(16).fillColor('#000000').text(title);
      doc.moveDown();
    }

    let count = 0;
    for (const message of messages) {
      const headerText = `${message.sender}   ${formatDate(message.date)}`;
      doc.font(fontFor(headerText, { bold: true })).fontSize(10).fillColor('#555555').text(headerText);
      doc.font(fontFor(message.text)).fontSize(11).fillColor('#000000').text(message.text);
      doc.moveDown();
      count += 1;
    }

    doc.end();
    stream.on('finish', () => resolve(count));
    stream.on('error', reject);
  });
}

module.exports = { fontFor, exportTranscriptToPdf };
