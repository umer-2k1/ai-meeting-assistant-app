/**
 * Meeting sharing: email (via the user's Gmail connector) and Slack (bot token).
 * Every attempt is recorded in IntegrationLog.
 */
import prisma from '../lib/prisma.js';
import { ConnectorManager } from '../connectors/connector-manager.js';
import type { GmailConnector } from '../connectors/google/gmail.js';
import { parseStringList } from '../lib/json-list.js';
import {
  buildMeetingEmailHtml,
  buildMeetingMarkdown,
  buildMeetingPdf,
  buildMeetingSlackText,
  type ExportMeeting,
} from './export.js';
import { postToSlack } from './slack.js';
import type { IntegrationType } from '../lib/enums.js';

async function logShare(
  integrationType: IntegrationType,
  meetingId: string,
  destination: string,
  status: 'success' | 'failed',
  error?: string
) {
  await prisma.integrationLog
    .create({
      data: { entityType: 'meeting', entityId: meetingId, integrationType, destination, status, error },
    })
    .catch(() => {});
}

export async function shareMeetingByEmail(
  userId: string,
  meetingId: string,
  meeting: ExportMeeting,
  recipients: string[]
): Promise<{ id: string }> {
  const destination = recipients.join(', ');
  try {
    const connector = (await ConnectorManager.getConnector(userId, 'GMAIL')) as GmailConnector;
    const result = await connector.sendEmail({
      to: recipients,
      subject: `Meeting summary: ${meeting.title}`,
      body: buildMeetingMarkdown(meeting),
      html: buildMeetingEmailHtml(meeting),
    });
    await logShare('EMAIL', meetingId, destination, 'success');
    return result;
  } catch (error) {
    await logShare(
      'EMAIL',
      meetingId,
      destination,
      'failed',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Dedupe (case-insensitive) + validate a list of candidate email addresses. */
function normalizeRecipients(candidates: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of candidates) {
    const email = raw?.trim();
    if (!email || !EMAIL_RE.test(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

/**
 * Automatically email the finished meeting summary to the owner + attendees when
 * the owner has a connected Gmail integration. Called at the end of
 * `processMeeting` — best-effort, so any failure is logged and swallowed (it must
 * never fail the meeting).
 *
 * Delivers: the AI summary/decisions/risks/action items inline, the PDF report
 * and full-transcript Markdown as attachments, and the recording as a download
 * link. Idempotent: a prior successful EMAIL log for the meeting short-circuits,
 * so re-processing never re-sends.
 */
export async function autoEmailMeetingSummary(meetingId: string): Promise<void> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      user: { select: { id: true, email: true } },
      attendees: true,
      actionItems: { orderBy: { createdAt: 'desc' } },
      transcript: { orderBy: { timestampSeconds: 'asc' } },
      tags: true,
      notes: true,
    },
  });
  if (!meeting) return;
  const userId = meeting.userId;

  // Only send when Gmail is actually connected for this user.
  if (!(await ConnectorManager.isConnected(userId, 'GMAIL'))) return;

  // Idempotency guard: never send twice for the same meeting (e.g. on reprocess).
  const alreadySent = await prisma.integrationLog.findFirst({
    where: { entityId: meetingId, integrationType: 'EMAIL', status: 'success' },
    select: { id: true },
  });
  if (alreadySent) return;

  const recipients = normalizeRecipients([
    meeting.user?.email,
    ...meeting.attendees.map((a) => a.email),
  ]);
  if (recipients.length === 0) return;

  const exportMeeting: ExportMeeting = {
    title: meeting.title,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    duration: meeting.duration,
    platform: meeting.platform,
    platformUrl: meeting.platformUrl,
    aiSummary: meeting.aiSummary,
    keyDecisions: parseStringList(meeting.keyDecisions),
    risks: parseStringList(meeting.risks),
    highlights: parseStringList(meeting.highlights),
    attendees: meeting.attendees.map((a) => ({ name: a.name, email: a.email, role: a.role })),
    actionItems: meeting.actionItems.map((a) => ({
      task: a.task,
      assignee: a.assignee,
      dueDate: a.dueDate,
      priority: a.priority,
      status: a.status,
    })),
    transcript: meeting.transcript.map((t) => ({
      speaker: t.speaker,
      text: t.text,
      timestamp: t.timestamp,
    })),
    notes: meeting.notes.map((n) => ({ content: n.content })),
    tags: meeting.tags.map((t) => ({ name: t.name })),
  };

  const safeName = meeting.title.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'meeting';
  const attachments: NonNullable<Parameters<GmailConnector['sendEmail']>[0]['attachments']> = [];
  try {
    const pdf = await buildMeetingPdf(exportMeeting);
    attachments.push({
      filename: `${safeName}.pdf`,
      content: pdf.toString('base64'),
      contentType: 'application/pdf',
    });
  } catch (error) {
    console.warn('[autoEmail] PDF generation failed (sending without it):', error);
  }

  const markdown = buildMeetingMarkdown(exportMeeting);
  attachments.push({
    filename: `${safeName}-transcript.md`,
    content: Buffer.from(markdown, 'utf8').toString('base64'),
    contentType: 'text/markdown; charset=UTF-8',
  });

  const attachmentNote = meeting.audioUrl
    ? 'Attached: PDF summary and full transcript (Markdown). The audio recording is linked above.'
    : 'Attached: PDF summary and full transcript (Markdown).';

  try {
    const connector = (await ConnectorManager.getConnector(userId, 'GMAIL')) as GmailConnector;
    await connector.sendEmail({
      to: recipients,
      subject: `Meeting summary: ${meeting.title}`,
      body: markdown,
      html: buildMeetingEmailHtml(exportMeeting, {
        audioUrl: meeting.audioUrl,
        attachmentNote,
      }),
      attachments,
    });
    await logShare('EMAIL', meetingId, recipients.join(', '), 'success');
    console.log(`[autoEmail] Sent meeting summary for ${meetingId} to ${recipients.length} recipient(s)`);
  } catch (error) {
    await logShare(
      'EMAIL',
      meetingId,
      recipients.join(', '),
      'failed',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

export async function shareMeetingToSlack(
  meetingId: string,
  meeting: ExportMeeting,
  channel: string
): Promise<void> {
  try {
    await postToSlack(channel, buildMeetingSlackText(meeting));
    await logShare('SLACK', meetingId, channel, 'success');
  } catch (error) {
    await logShare(
      'SLACK',
      meetingId,
      channel,
      'failed',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}
