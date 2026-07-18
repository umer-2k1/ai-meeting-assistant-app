/**
 * Slack Web API calls, scoped to one workspace installation.
 *
 * Every function takes an explicit bot token rather than reading a global env
 * var, so the same code serves one workspace today and many later. Resolve the
 * token with `getSlackInstallation(userId)` from `connectors/slack/oauth.ts`.
 */
const SLACK_API = 'https://slack.com/api';

async function slackApi<T = Record<string, unknown>>(
  token: string,
  method: string,
  body: Record<string, unknown>
): Promise<T> {
  if (!token) throw new Error('Slack is not connected for this user');

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

/**
 * Slack errors that mean the install is gone rather than the call being wrong.
 * These map to the same "reconnect required" prompt the Google connectors use.
 */
const DEAD_INSTALL_ERRORS = new Set([
  'token_revoked',
  'invalid_auth',
  'account_inactive',
  'token_expired',
]);

export function isDeadSlackInstall(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return [...DEAD_INSTALL_ERRORS].some((code) => message.includes(code));
}

export interface SlackChannel {
  id: string;
  name: string;
}

/** List public channels in the installed workspace (for the share picker). */
export async function listSlackChannels(token: string): Promise<SlackChannel[]> {
  const data = await slackApi<{ channels?: Array<{ id: string; name: string }> }>(
    token,
    'conversations.list',
    { types: 'public_channel', exclude_archived: true, limit: 200 }
  );
  return (data.channels ?? []).map((c) => ({ id: c.id, name: c.name }));
}

/**
 * Post to a channel. Slack rejects `chat.postMessage` with `not_in_channel`
 * for a public channel the bot has not joined, so join on demand — that is what
 * the `channels:join` scope is for.
 */
export async function postToSlack(
  token: string,
  channel: string,
  text: string,
  options: { threadTs?: string } = {}
): Promise<void> {
  const payload: Record<string, unknown> = {
    channel,
    text,
    unfurl_links: false,
    ...(options.threadTs ? { thread_ts: options.threadTs } : {}),
  };

  try {
    await slackApi(token, 'chat.postMessage', payload);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('not_in_channel')) throw error;
    await slackApi(token, 'conversations.join', { channel });
    await slackApi(token, 'chat.postMessage', payload);
  }
}

export interface SlackUserIdentity {
  slackUserId: string;
  email: string | null;
  name: string | null;
}

/**
 * Resolve the human behind a Slack user id. The email is what links them to an
 * app account — meetings are per-user, so without it an inbound question cannot
 * be answered against the right person's data.
 */
export async function getSlackUserIdentity(
  token: string,
  slackUserId: string
): Promise<SlackUserIdentity> {
  const data = await slackApi<{
    user?: { profile?: { email?: string; real_name?: string } };
  }>(token, 'users.info', { user: slackUserId });

  return {
    slackUserId,
    email: data.user?.profile?.email ?? null,
    name: data.user?.profile?.real_name ?? null,
  };
}
