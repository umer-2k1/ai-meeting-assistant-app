/**
 * Slack integration (app-level bot token).
 *
 * Uses SLACK_BOT_TOKEN to list channels and post meeting reports. This is
 * optional — when the token is absent the feature is reported as unconfigured
 * (the UI disables it rather than faking it).
 */
const SLACK_API = 'https://slack.com/api';

export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_BOT_TOKEN);
}

async function slackApi<T = Record<string, unknown>>(
  method: string,
  body: Record<string, unknown>
): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('Slack is not configured (SLACK_BOT_TOKEN missing)');

  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!data.ok) {
    throw new Error(`Slack ${method} failed: ${data.error ?? 'unknown_error'}`);
  }
  return data;
}

export interface SlackChannel {
  id: string;
  name: string;
}

/** List public channels the bot can see (for the share picker). */
export async function listSlackChannels(): Promise<SlackChannel[]> {
  const data = await slackApi<{ channels?: Array<{ id: string; name: string }> }>(
    'conversations.list',
    { types: 'public_channel', exclude_archived: true, limit: 200 }
  );
  return (data.channels ?? []).map((c) => ({ id: c.id, name: c.name }));
}

/** Post a formatted message to a channel. */
export async function postToSlack(channel: string, text: string): Promise<void> {
  await slackApi('chat.postMessage', { channel, text, unfurl_links: false });
}
