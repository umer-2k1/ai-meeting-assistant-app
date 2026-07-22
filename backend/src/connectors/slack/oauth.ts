/**
 * Slack OAuth v2 (per-installation bot tokens).
 *
 * Replaces the old single `SLACK_BOT_TOKEN` env var. Each install stores its own
 * bot token in the `Integration` table under `provider: 'SLACK'`, with the Slack
 * workspace identifiers in `metadata`.
 *
 * Storage is shaped for multi-workspace from day one even though the app is
 * currently used with a single workspace: every Slack call resolves its token
 * through `getSlackInstallation`, so supporting many workspaces later means
 * changing that lookup rather than rewriting the callers.
 */
import jwt from 'jsonwebtoken';

import prisma from '../../lib/prisma.js';
import { serializeStringList } from '../../lib/json-list.js';

const SLACK_API = 'https://slack.com/api';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID ?? '';
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET ?? '';

export const SLACK_REDIRECT_URI =
  process.env.SLACK_REDIRECT_URI || 'http://localhost:3001/api/integrations/slack/callback';

/**
 * Bot scopes requested at install.
 * - chat:write            post meeting reports
 * - channels:read         list public channels for the share picker
 * - channels:join         join a public channel so chat:write succeeds without a manual invite
 * - app_mentions:read     receive @-mentions (inbound Q&A, wired in a later step)
 * - users:read            resolve the Slack user behind a mention
 * - users:read.email      map that Slack user to an app account by email
 */
export const SLACK_BOT_SCOPES = [
  'chat:write',
  'channels:read',
  'channels:join',
  'app_mentions:read',
  'users:read',
  'users:read.email',
];

export function isSlackOAuthConfigured(): boolean {
  return Boolean(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);
}

export function getSlackOAuthConfigIssues(): string[] {
  const issues: string[] = [];
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    issues.push('Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in backend/.env');
  }
  if (!process.env.SLACK_SIGNING_SECRET) {
    issues.push('Set SLACK_SIGNING_SECRET in backend/.env (required to verify inbound events)');
  }
  if (!SLACK_REDIRECT_URI.includes('/api/integrations/slack/callback')) {
    issues.push(
      'SLACK_REDIRECT_URI should end in /api/integrations/slack/callback and match the Slack app config exactly'
    );
  }
  return issues;
}

export interface SlackInstallation {
  botToken: string;
  teamId: string;
  teamName: string | null;
  botUserId: string | null;
  authedUserId: string | null;
}

type SlackInstallMetadata = {
  teamId?: unknown;
  teamName?: unknown;
  botUserId?: unknown;
  authedUserId?: unknown;
};

/**
 * OAuth `state`, signed so a forged callback cannot attach someone else's Slack
 * workspace to an account. Short-lived: the user is mid-redirect, not idle.
 */
interface SlackOAuthState {
  userId: string;
  isDesktop: boolean;
}

function stateSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to sign Slack OAuth state');
  return secret;
}

export function encodeSlackState(state: SlackOAuthState): string {
  return jwt.sign(state, stateSecret(), { expiresIn: '10m' });
}

export function decodeSlackState(raw: string): SlackOAuthState | null {
  try {
    const decoded = jwt.verify(raw, stateSecret()) as Partial<SlackOAuthState>;
    if (typeof decoded?.userId !== 'string') return null;
    return { userId: decoded.userId, isDesktop: Boolean(decoded.isDesktop) };
  } catch (error) {
    console.warn('[slack:oauth] rejected state:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Build the "Add to Slack" consent URL. */
export function generateSlackInstallUrl(
  userId: string,
  options: { isDesktop?: boolean } = {}
): string {
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: SLACK_BOT_SCOPES.join(','),
    redirect_uri: SLACK_REDIRECT_URI,
    state: encodeSlackState({ userId, isDesktop: Boolean(options.isDesktop) }),
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/** Exchange the callback code for a workspace bot token. */
export async function exchangeSlackCode(code: string): Promise<SlackInstallation> {
  const res = await fetch(`${SLACK_API}/oauth.v2.access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: SLACK_REDIRECT_URI,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    bot_user_id?: string;
    team?: { id?: string; name?: string };
    authed_user?: { id?: string };
  };

  if (!data.ok || !data.access_token) {
    throw new Error(`Slack oauth.v2.access failed: ${data.error ?? 'unknown_error'}`);
  }
  if (!data.team?.id) {
    throw new Error('Slack oauth.v2.access returned no team id');
  }

  return {
    botToken: data.access_token,
    teamId: data.team.id,
    teamName: data.team.name ?? null,
    botUserId: data.bot_user_id ?? null,
    authedUserId: data.authed_user?.id ?? null,
  };
}

export async function saveSlackInstallation(
  userId: string,
  install: SlackInstallation
): Promise<void> {
  await prisma.integration.upsert({
    where: { userId_provider: { userId, provider: 'SLACK' } },
    create: {
      userId,
      provider: 'SLACK',
      accessToken: install.botToken,
      scopes: serializeStringList(SLACK_BOT_SCOPES),
      isActive: true,
      metadata: {
        teamId: install.teamId,
        teamName: install.teamName,
        botUserId: install.botUserId,
        authedUserId: install.authedUserId,
      },
    },
    update: {
      accessToken: install.botToken,
      scopes: serializeStringList(SLACK_BOT_SCOPES),
      isActive: true,
      lastSyncAt: new Date(),
      metadata: {
        teamId: install.teamId,
        teamName: install.teamName,
        botUserId: install.botUserId,
        authedUserId: install.authedUserId,
      },
    },
  });
}

/**
 * The single token lookup every Slack call goes through. Returns null when the
 * user has not installed the app (or it was uninstalled).
 */
export async function getSlackInstallation(userId: string): Promise<SlackInstallation | null> {
  const row = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'SLACK' } },
  });
  if (!row?.isActive || !row.accessToken) return null;

  const meta = (row.metadata ?? {}) as SlackInstallMetadata;
  return {
    botToken: row.accessToken,
    teamId: typeof meta.teamId === 'string' ? meta.teamId : '',
    teamName: typeof meta.teamName === 'string' ? meta.teamName : null,
    botUserId: typeof meta.botUserId === 'string' ? meta.botUserId : null,
    authedUserId: typeof meta.authedUserId === 'string' ? meta.authedUserId : null,
  };
}

/** Look up an installation by workspace — the entry point inbound events need. */
export async function getSlackInstallationByTeam(
  teamId: string
): Promise<(SlackInstallation & { userId: string }) | null> {
  const rows = await prisma.integration.findMany({
    where: { provider: 'SLACK', isActive: true },
  });

  for (const row of rows) {
    const meta = (row.metadata ?? {}) as SlackInstallMetadata;
    if (meta.teamId === teamId && row.accessToken) {
      return {
        userId: row.userId,
        botToken: row.accessToken,
        teamId,
        teamName: typeof meta.teamName === 'string' ? meta.teamName : null,
        botUserId: typeof meta.botUserId === 'string' ? meta.botUserId : null,
        authedUserId: typeof meta.authedUserId === 'string' ? meta.authedUserId : null,
      };
    }
  }
  return null;
}

/**
 * Per-connection Slack settings (default channel, auto-post). Stored alongside
 * the install in `Integration.metadata` rather than `User.preferences`: they are
 * meaningless without a Slack connection, and disconnecting should take them
 * with it.
 */
export interface SlackPreferences {
  defaultChannelId: string | null;
  defaultChannelName: string | null;
  /** Post the summary to the default channel when a meeting finishes processing. */
  autoPost: boolean;
}

export const DEFAULT_SLACK_PREFERENCES: SlackPreferences = {
  defaultChannelId: null,
  defaultChannelName: null,
  autoPost: false,
};

export async function getSlackPreferences(userId: string): Promise<SlackPreferences> {
  const row = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'SLACK' } },
  });
  const meta = (row?.metadata ?? {}) as Record<string, unknown>;

  return {
    defaultChannelId:
      typeof meta.defaultChannelId === 'string' ? meta.defaultChannelId : null,
    defaultChannelName:
      typeof meta.defaultChannelName === 'string' ? meta.defaultChannelName : null,
    autoPost: meta.autoPost === true,
  };
}

export async function saveSlackPreferences(
  userId: string,
  prefs: Partial<SlackPreferences>
): Promise<SlackPreferences> {
  const row = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'SLACK' } },
  });
  if (!row) throw new Error('Slack is not connected');

  // Merge into existing metadata — the install identifiers live in the same blob.
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const current = await getSlackPreferences(userId);
  const next: SlackPreferences = { ...current, ...prefs };

  await prisma.integration.update({
    where: { id: row.id },
    data: { metadata: { ...meta, ...next } },
  });

  return next;
}

/** Revoke at Slack, then drop locally. Best-effort remote call. */
export async function disconnectSlack(userId: string): Promise<void> {
  const install = await getSlackInstallation(userId);

  if (install) {
    try {
      await fetch(`${SLACK_API}/auth.revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${install.botToken}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      // Local disconnect still has to succeed, or the UI is stuck showing connected.
      console.warn('[slack:oauth] auth.revoke failed:', error);
    }
  }

  await prisma.integration.updateMany({
    where: { userId, provider: 'SLACK' },
    data: { isActive: false, accessToken: null },
  });
}
