/**
 * Meeting export: Markdown + PDF report generation.
 *
 * Consumes a meeting with parsed list fields + relations (see
 * `serializeMeetingForApi` + `getMeetingWithDetails`) and renders a shareable
 * report containing summary, decisions, risks, action items, transcript & notes.
 */
import PDFDocument from 'pdfkit';

export interface ExportMeeting {
  title: string;
  startTime: Date | string;
  endTime?: Date | string | null;
  duration?: number | null;
  platform?: string | null;
  platformUrl?: string | null;
  aiSummary?: string | null;
  keyDecisions: string[];
  risks: string[];
  highlights: string[];
  attendees?: Array<{ name: string; email?: string | null; role?: string | null }>;
  actionItems?: Array<{
    task: string;
    assignee?: string | null;
    dueDate?: Date | string | null;
    priority?: string | null;
    status?: string | null;
  }>;
  transcript?: Array<{ speaker: string; text: string; timestamp: string }>;
  notes?: Array<{ content: string }>;
  tags?: Array<{ name: string }>;
}

function fmtDate(value?: Date | string | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

/** Date-only formatting (no time) — used for due dates where the time is noise. */
function fmtDay(value?: Date | string | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

function fmtDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Render a meeting as a Markdown report. */
export function buildMeetingMarkdown(m: ExportMeeting): string {
  const lines: string[] = [];
  lines.push(`# ${m.title}`, '');
  lines.push(`**Date:** ${fmtDate(m.startTime)}  `);
  lines.push(`**Duration:** ${fmtDuration(m.duration)}  `);
  if (m.platform) lines.push(`**Platform:** ${m.platform}  `);
  if (m.platformUrl) lines.push(`**Link:** ${m.platformUrl}  `);
  if (m.tags?.length) lines.push(`**Tags:** ${m.tags.map((t) => `#${t.name}`).join(' ')}  `);
  lines.push('');

  if (m.attendees?.length) {
    lines.push('## Attendees', '');
    for (const a of m.attendees) {
      const meta = [a.role, a.email].filter(Boolean).join(', ');
      lines.push(`- ${a.name}${meta ? ` (${meta})` : ''}`);
    }
    lines.push('');
  }

  lines.push('## Summary', '', m.aiSummary?.trim() || '_No summary generated._', '');

  if (m.highlights?.length) {
    lines.push('## Key Points', '', ...m.highlights.map((h) => `- ${h}`), '');
  }
  if (m.keyDecisions?.length) {
    lines.push('## Decisions', '', ...m.keyDecisions.map((d) => `- ${d}`), '');
  }
  if (m.risks?.length) {
    lines.push('## Risks & Blockers', '', ...m.risks.map((r) => `- ${r}`), '');
  }

  if (m.actionItems?.length) {
    lines.push('## Action Items', '');
    for (const item of m.actionItems) {
      const bits = [
        item.assignee ? `**${item.assignee}**` : null,
        item.priority ? `_${item.priority}_` : null,
        item.dueDate ? `due ${fmtDate(item.dueDate)}` : null,
      ].filter(Boolean);
      lines.push(`- [ ] ${item.task}${bits.length ? ` — ${bits.join(', ')}` : ''}`);
    }
    lines.push('');
  }

  if (m.transcript?.length) {
    lines.push('## Transcript', '');
    for (const line of m.transcript) {
      lines.push(`**[${line.timestamp}] ${line.speaker}:** ${line.text}`, '');
    }
  }

  if (m.notes?.length) {
    lines.push('## Notes', '');
    for (const note of m.notes) lines.push(note.content, '');
  }

  return lines.join('\n');
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Render a compact HTML email body for a meeting report.
 *
 * `opts.audioUrl` adds a "Recording" download link; `opts.attachmentNote`
 * describes any attached files (PDF/transcript) — both are used by the automatic
 * post-meeting email and safely omitted when not provided.
 */
export function buildMeetingEmailHtml(
  m: ExportMeeting,
  opts?: { audioUrl?: string | null; attachmentNote?: string | null }
): string {
  const section = (title: string, items: string[]) =>
    items.length
      ? `<h3 style="margin:16px 0 6px;color:#1E3A8A">${esc(title)}</h3><ul style="margin:0;padding-left:18px">${items
          .map((i) => `<li>${esc(i)}</li>`)
          .join('')}</ul>`
      : '';

  const actions = (m.actionItems ?? []).map((a) => {
    const bits = [a.assignee, a.priority, a.dueDate ? `due ${fmtDate(a.dueDate)}` : null]
      .filter(Boolean)
      .join(', ');
    return `${a.task}${bits ? ` — ${bits}` : ''}`;
  });

  const recording = opts?.audioUrl
    ? `<h3 style="margin:16px 0 6px;color:#1E3A8A">Recording</h3><p style="margin:0"><a href="${esc(
        opts.audioUrl
      )}" style="color:#1E3A8A">Download the audio recording</a></p>`
    : '';

  const attachments = opts?.attachmentNote
    ? `<p style="color:#666;font-size:13px;margin:16px 0 0">${esc(opts.attachmentNote)}</p>`
    : '';

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;color:#222">
    <h2 style="margin:0 0 4px">${esc(m.title)}</h2>
    <p style="color:#666;margin:0 0 12px">${esc(fmtDate(m.startTime))} • ${esc(fmtDuration(m.duration))}</p>
    <h3 style="margin:16px 0 6px;color:#1E3A8A">Summary</h3>
    <p>${esc(m.aiSummary?.trim() || 'No summary generated.')}</p>
    ${section('Key Points', m.highlights ?? [])}
    ${section('Decisions', m.keyDecisions ?? [])}
    ${section('Risks & Blockers', m.risks ?? [])}
    ${section('Action Items', actions)}
    ${recording}
    ${attachments}
    <p style="color:#999;font-size:12px;margin-top:20px">Sent via AI Meeting Copilot</p>
  </div>`;
}

/** Build a Slack mrkdwn message for a meeting report. */
export function buildMeetingSlackText(m: ExportMeeting): string {
  const parts: string[] = [`*${m.title}*`, `_${fmtDate(m.startTime)} • ${fmtDuration(m.duration)}_`, ''];
  if (m.aiSummary?.trim()) parts.push(`*Summary*\n${m.aiSummary.trim()}`, '');
  if (m.keyDecisions?.length)
    parts.push('*Decisions*', ...m.keyDecisions.map((d) => `• ${d}`), '');
  if (m.actionItems?.length) {
    parts.push('*Action Items*');
    for (const a of m.actionItems) {
      const who = a.assignee ? ` (${a.assignee})` : '';
      parts.push(`• ${a.task}${who}`);
    }
    parts.push('');
  }
  if (m.highlights?.length) parts.push('*Highlights*', ...m.highlights.map((h) => `• ${h}`));
  return parts.join('\n').trim();
}

/**
 * Render a meeting as a PDF report (returns the file bytes).
 *
 * Layout goals: generous margins and line spacing, a clear typographic hierarchy
 * (title → section headings with an accent rule → readable body/bullets), and
 * comfortable whitespace between sections so the document reads like a report
 * rather than a dense wall of text.
 */
export function buildMeetingPdf(m: ExportMeeting): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      // Wider margins frame the content and stop lines running edge-to-edge.
      margins: { top: 64, bottom: 64, left: 64, right: 64 },
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const INK = '#1f2937'; // slate-800 — softer than pure black, easier to read
    const MUTED = '#6b7280'; // slate-500
    const ACCENT = '#1E3A8A'; // brand indigo
    const RULE = '#e5e7eb'; // slate-200

    const left = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageBottom = () => doc.page.height - doc.page.margins.bottom;

    /** Add a page break if less than `min` vertical space remains (avoids orphaned headings). */
    const ensureSpace = (min: number) => {
      if (doc.y + min > pageBottom()) doc.addPage();
    };

    const rule = (color = RULE, width = 1) => {
      const y = doc.y;
      doc.save().moveTo(left, y).lineTo(left + contentWidth, y).lineWidth(width).strokeColor(color).stroke().restore();
    };

    const heading = (t: string) => {
      ensureSpace(64);
      doc.moveDown(1.1);
      doc.font('Helvetica-Bold').fontSize(13).fillColor(ACCENT).text(t.toUpperCase(), { characterSpacing: 0.6 });
      doc.moveDown(0.25);
      rule();
      doc.moveDown(0.55);
    };

    const paragraph = (t: string) =>
      doc.font('Helvetica').fontSize(11).fillColor(INK).text(t, {
        align: 'left',
        lineGap: 4,
        paragraphGap: 6,
      });

    const bullets = (items: string[]) =>
      doc.font('Helvetica').fontSize(11).fillColor(INK).list(items, {
        bulletRadius: 1.6,
        textIndent: 14,
        bulletIndent: 2,
        lineGap: 3,
        paragraphGap: 7,
      });

    // ---- Header ----
    doc.font('Helvetica-Bold').fontSize(24).fillColor(INK).text(m.title, { lineGap: 2 });
    doc.moveDown(0.35);
    const metaBits = [fmtDate(m.startTime), fmtDuration(m.duration), m.platform || null]
      .filter(Boolean)
      .join('   •   ');
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(metaBits);
    if (m.tags?.length) {
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(10).fillColor(ACCENT).text(m.tags.map((t) => `#${t.name}`).join('   '));
    }
    doc.moveDown(0.6);
    rule(ACCENT, 1.5);

    // ---- Attendees ----
    if (m.attendees?.length) {
      heading('Attendees');
      bullets(
        m.attendees.map((a) => {
          const meta = [a.role, a.email].filter(Boolean).join(', ');
          return `${a.name}${meta ? ` (${meta})` : ''}`;
        })
      );
    }

    // ---- Summary ----
    heading('Summary');
    paragraph(m.aiSummary?.trim() || 'No summary generated.');

    if (m.highlights?.length) {
      heading('Key Points');
      bullets(m.highlights);
    }
    if (m.keyDecisions?.length) {
      heading('Decisions');
      bullets(m.keyDecisions);
    }
    if (m.risks?.length) {
      heading('Risks & Blockers');
      bullets(m.risks);
    }

    // ---- Action Items (checkbox glyph + hanging indent) ----
    if (m.actionItems?.length) {
      heading('Action Items');
      for (const item of m.actionItems) {
        ensureSpace(28);
        const bits = [item.assignee, item.priority, item.dueDate ? `due ${fmtDay(item.dueDate)}` : null]
          .filter(Boolean)
          .join('  ·  ');
        const startY = doc.y;
        // Draw a real checkbox — the ☐ glyph isn't in PDFKit's default font.
        doc
          .save()
          .lineWidth(1)
          .strokeColor(ACCENT)
          .rect(left + 1, startY + 2, 9, 9)
          .stroke()
          .restore();
        doc.font('Helvetica').fontSize(11).fillColor(INK).text(item.task, left + 20, startY, {
          width: contentWidth - 20,
          lineGap: 3,
        });
        if (bits) {
          doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(bits, left + 20, doc.y, {
            width: contentWidth - 20,
          });
        }
        doc.moveDown(0.6);
      }
    }

    // ---- Transcript ----
    if (m.transcript?.length) {
      heading('Transcript');
      for (const line of m.transcript) {
        ensureSpace(40);
        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor(ACCENT)
          .text(`${line.speaker}`, { continued: true })
          .font('Helvetica')
          .fontSize(9.5)
          .fillColor(MUTED)
          .text(`   ${line.timestamp}`);
        doc.moveDown(0.15);
        doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(line.text, { lineGap: 3 });
        doc.moveDown(0.55);
      }
    }

    // ---- Notes ----
    if (m.notes?.length) {
      heading('Notes');
      for (const note of m.notes) {
        paragraph(note.content);
        doc.moveDown(0.3);
      }
    }

    doc.end();
  });
}
