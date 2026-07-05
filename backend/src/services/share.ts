/**
 * Meeting sharing: email (via the user's Gmail connector) and Slack (bot token).
 * Every attempt is recorded in IntegrationLog.
 */
import prisma from '../lib/prisma.js';
import { ConnectorManager } from '../connectors/connector-manager.js';
import type { GmailConnector } from '../connectors/google/gmail.js';
import {
  buildMeetingEmailHtml,
  buildMeetingMarkdown,
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
