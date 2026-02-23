const express = require('express');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle
} = require('docx');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies — increase limit for large message payloads
app.use(express.json({ limit: '200mb' }));
app.use(express.static(__dirname));

// ─────────────────────────────────────────────
// POST /export
// Body: { messages: [...], opts: {...}, filename: "..." }
// Returns: .docx file as download
// ─────────────────────────────────────────────
app.post('/export', async (req, res) => {
  try {
    const { messages, opts, filename } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'No messages provided' });
    }

    const children = [];

    // ── HEADER BLOCK ──
    if (opts.header) {
      children.push(new Paragraph({
        children: [new TextRun({
          text: 'Chat Log \u2014 Documentation Record',
          bold: true, size: 28, font: 'Calibri'
        })],
        spacing: { after: 120 }
      }));

      const d1 = new Date(messages[0].dateMs);
      const d2 = new Date(messages[messages.length - 1].dateMs);
      const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const dateRange = d1.toDateString() === d2.toDateString()
        ? fmt(d1)
        : `${fmt(d1)} \u2013 ${fmt(d2)}`;
      const uniqueSenders = [...new Set(messages.map(m => m.from))].join(', ');

      children.push(new Paragraph({
        children: [new TextRun({
          text: `Platform: Telegram | Participants: ${uniqueSenders} | ${dateRange}`,
          size: 20, font: 'Calibri', color: '444444'
        })],
        spacing: { after: 240 }
      }));
    }

    // ── MESSAGES ──
    let lastDate = null;

    for (const m of messages) {
      const dStr = new Date(m.dateMs).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      });

      // Date divider
      if (opts.dates && dStr !== lastDate) {
        lastDate = dStr;
        children.push(new Paragraph({
          children: [new TextRun({
            text: `\u2014\u2014\u2014 ${dStr} \u2014\u2014\u2014`,
            italics: true, size: 18, font: 'Calibri', color: '888888'
          })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 160 }
        }));
      }

      const timeStr = new Date(m.dateMs).toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit'
      });

      // Author + time
      const headRuns = [
        new TextRun({ text: m.from, bold: true, size: 22, font: 'Calibri' })
      ];
      if (opts.time) {
        headRuns.push(new TextRun({ text: '  ' + timeStr, size: 20, font: 'Calibri', color: '999999' }));
      }
      if (opts.edited && m.edited) {
        headRuns.push(new TextRun({ text: '  (edited)', italics: true, size: 18, font: 'Calibri', color: 'aaaaaa' }));
      }
      if (m.forwarded_from) {
        headRuns.push(new TextRun({
          text: `  \u21A9 fwd: ${m.forwarded_from}`,
          italics: true, size: 18, font: 'Calibri', color: 'aaaaaa'
        }));
      }

      children.push(new Paragraph({
        children: headRuns,
        spacing: { before: 160, after: 60 }
      }));

      // Reply context
      if (opts.reply && m.replyFrom) {
        const preview = m.replyText.length > 120
          ? m.replyText.slice(0, 120) + '\u2026'
          : m.replyText;
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${m.replyFrom}: `, bold: true, italics: true, size: 18, font: 'Calibri', color: '888888' }),
            new TextRun({ text: preview, italics: true, size: 18, font: 'Calibri', color: '888888' })
          ],
          indent: { left: 720 },
          border: { left: { style: BorderStyle.SINGLE, size: 6, color: 'cccccc', space: 8 } },
          spacing: { after: 60 }
        }));
      }

      // Message text — split newlines into separate paragraphs
      if (m.text) {
        const lines = m.text.split('\n');
        lines.forEach((line, i) => {
          children.push(new Paragraph({
            children: [new TextRun({ text: line || ' ', size: 21, font: 'Calibri', color: '222222' })],
            indent: { left: 720 },
            spacing: { after: i === lines.length - 1 ? 120 : 40 }
          }));
        });
      }

      // Media notes
      if (opts.media) {
        if (m.photo) {
          children.push(new Paragraph({
            children: [new TextRun({ text: '[Photo attachment]', italics: true, size: 19, font: 'Calibri', color: '999999' })],
            indent: { left: 720 }, spacing: { after: 100 }
          }));
        }
        if (m.file) {
          const fname = (m.file || '').split('/').pop() || 'File';
          children.push(new Paragraph({
            children: [new TextRun({ text: `[File: ${fname}]`, italics: true, size: 19, font: 'Calibri', color: '999999' })],
            indent: { left: 720 }, spacing: { after: 100 }
          }));
        }
      }
    }

    // Build document
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
          }
        },
        children
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const safeFilename = (filename || 'chat_transcript').replace(/[^a-zA-Z0-9_\-]/g, '_');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.docx"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (err) {
    console.error('[/export] Error:', err);
    res.status(500).json({ error: err.message || 'Export failed' });
  }
});

// Fallback: serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  TG Exporter running at http://localhost:${PORT}\n`);
});
