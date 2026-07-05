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

/** Render a compact HTML email body for a meeting report. */
export function buildMeetingEmailHtml(m: ExportMeeting): string {
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

/** Render a meeting as a PDF report (returns the file bytes). */
export function buildMeetingPdf(m: ExportMeeting): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const h1 = (t: string) => doc.moveDown(0.5).fontSize(18).fillColor('#111').text(t);
    const h2 = (t: string) => doc.moveDown(0.6).fontSize(13).fillColor('#1E3A8A').text(t);
    const body = (t: string) => doc.fontSize(10.5).fillColor('#222').text(t);

    h1(m.title);
    doc.fontSize(9).fillColor('#666').text(
      `${fmtDate(m.startTime)}  •  ${fmtDuration(m.duration)}${m.platform ? `  •  ${m.platform}` : ''}`
    );

    if (m.attendees?.length) {
      h2('Attendees');
      for (const a of m.attendees) {
        const meta = [a.role, a.email].filter(Boolean).join(', ');
        body(`• ${a.name}${meta ? ` (${meta})` : ''}`);
      }
    }

    h2('Summary');
    body(m.aiSummary?.trim() || 'No summary generated.');

    if (m.highlights?.length) {
      h2('Key Points');
      m.highlights.forEach((x) => body(`• ${x}`));
    }
    if (m.keyDecisions?.length) {
      h2('Decisions');
      m.keyDecisions.forEach((x) => body(`• ${x}`));
    }
    if (m.risks?.length) {
      h2('Risks & Blockers');
      m.risks.forEach((x) => body(`• ${x}`));
    }
    if (m.actionItems?.length) {
      h2('Action Items');
      for (const item of m.actionItems) {
        const bits = [item.assignee, item.priority, item.dueDate ? `due ${fmtDate(item.dueDate)}` : null]
          .filter(Boolean)
          .join(', ');
        body(`☐ ${item.task}${bits ? ` — ${bits}` : ''}`);
      }
    }
    if (m.transcript?.length) {
      h2('Transcript');
      for (const line of m.transcript) {
        doc.fontSize(10.5).fillColor('#1E3A8A').text(`[${line.timestamp}] ${line.speaker}: `, {
          continued: true,
        });
        doc.fillColor('#222').text(line.text);
      }
    }
    if (m.notes?.length) {
      h2('Notes');
      m.notes.forEach((n) => body(n.content));
    }

    doc.end();
  });
}
