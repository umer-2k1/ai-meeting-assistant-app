/**
 * Integrations API Client
 * 
 * Frontend API client for managing integrations
 */

import { isDesktopApp } from './google-auth';

import { BACKEND_URL } from './config';
const TOKEN_KEY = 'ai_meeting_token';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  return response;
}

export interface ProviderStatus {
  connected: boolean;
  email?: string;
  lastSync?: string;
  /**
   * The stored Google grant was revoked or expired (`invalid_grant`). Only
   * re-consent fixes this, so the UI must prompt to reconnect rather than
   * showing a plain "Not connected" and waiting for a recovery that can't come.
   */
  needsReconnect?: boolean;
  /** Human-readable reason the provider isn't usable. */
  error?: string;
}

export interface SlackProviderStatus extends ProviderStatus {
  /** Slack workspace name, once installed. */
  workspace?: string;
  /** Whether the server has SLACK_CLIENT_ID/SECRET — without them, no install is possible. */
  configured?: boolean;
}

export interface IntegrationStatus {
  calendar: ProviderStatus;
  gmail: ProviderStatus;
  slack: SlackProviderStatus;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: Array<{
    email: string;
    name?: string;
    responseStatus?: string;
  }>;
  meetLink?: string;
  status?: string;
  recurring?: boolean;
}

/**
 * Get integration status for all connectors
 */
export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const response = await apiFetch('/api/integrations/status', {
    method: 'GET',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch integration status');
  }
  
  return (await response.json()) as IntegrationStatus;
}

export type GoogleIntegrationProvider = 'GOOGLE_CALENDAR' | 'GMAIL';

/**
 * Initiate Google OAuth flow for a specific provider (Calendar or Gmail).
 * Returns the authorization URL to redirect the user to. Only the scopes
 * for the requested provider(s) are asked for on the Google consent screen.
 */
export async function connectGoogle(
  provider: GoogleIntegrationProvider
): Promise<{ authUrl: string }> {
  const response = await apiFetch('/api/integrations/google/connect', {
    method: 'POST',
    body: JSON.stringify({ provider, source: isDesktopApp() ? 'desktop' : undefined }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to initiate Google OAuth flow');
  }
  
  return (await response.json()) as { authUrl: string };
}

/** Which `/status` key a connect flow should watch to know it finished. */
type IntegrationStatusKey = 'calendar' | 'gmail' | 'slack';

function statusKeyFor(provider: GoogleIntegrationProvider): IntegrationStatusKey {
  return provider === 'GMAIL' ? 'gmail' : 'calendar';
}

async function isProviderConnected(statusKey: IntegrationStatusKey): Promise<boolean> {
  try {
    const status = await getIntegrationStatus();
    const connected = Boolean(status[statusKey]?.connected);
    console.log('[connect] status poll', { statusKey, connected, status });
    return connected;
  } catch (error) {
    console.warn('[connect] status poll failed', error);
    return false;
  }
}

type DesktopBridge = NonNullable<typeof globalThis.window.desktop>;

const CONNECT_POLL_MS = 2000;
const CONNECT_TIMEOUT_MS = 3 * 60 * 1000;
/**
 * Once the user is back in the app, how long the backend still gets to finish
 * committing the tokens before we call the attempt abandoned. Without this,
 * returning a beat before the callback lands would look like a cancel.
 */
const RETURN_GRACE_MS = 5000;

/**
 * Desktop completion watcher.
 *
 * Two rules hold this together:
 *   1. Only a confirmed `true` may settle success, and a negative read may
 *      never settle failure. A deep link is a hint to re-check, not a verdict —
 *      it routinely arrives before the backend has committed, and treating that
 *      early `false` as final is what reported a *successful* connect as
 *      "not connected".
 *   2. Failure is settled only by an explicit cancel, or by the user coming
 *      back to the app and staying (see RETURN_GRACE_MS) without connecting.
 */
function waitForDesktopConnect(
  statusKey: IntegrationStatusKey,
  {
    alreadyConnected,
    desktop,
    signal
  }: { alreadyConnected: boolean; desktop: DesktopBridge; signal?: AbortSignal }
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let firstTick = true;
    /** A return only means "cancelled" if they actually left for the browser. */
    let hasLeftApp = false;
    let unsubscribe: (() => void) | undefined;
    let pollTimer: number | undefined;
    let timeoutId: number | undefined;
    let graceTimer: number | undefined;

    const finish = (connected: boolean) => {
      if (settled) return;
      settled = true;
      if (pollTimer !== undefined) window.clearInterval(pollTimer);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (graceTimer !== undefined) window.clearTimeout(graceTimer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      signal?.removeEventListener('abort', onAbort);
      unsubscribe?.();
      console.log('[connect] desktop flow finished', { statusKey, connected });
      resolve(connected);
    };

    const checkConnected = async (): Promise<boolean> => {
      if (settled) return false;
      const connected = await isProviderConnected(statusKey);
      if (settled) return false;
      // Skip the first read of a reconnect: it still reflects the OLD
      // connection, not the one being made right now.
      if (firstTick) {
        firstTick = false;
        if (connected && alreadyConnected) return false;
      }
      if (connected) finish(true);
      return connected;
    };

    const onAbort = () => {
      console.log('[connect] cancelled by user');
      finish(false);
    };

    const onBlur = () => {
      hasLeftApp = true;
      // Back off to the browser — any pending "did they cancel?" countdown is void.
      if (graceTimer !== undefined) {
        window.clearTimeout(graceTimer);
        graceTimer = undefined;
      }
    };

    const onFocus = () => {
      if (settled || !hasLeftApp) return;
      if (graceTimer !== undefined) window.clearTimeout(graceTimer);
      graceTimer = window.setTimeout(() => {
        void checkConnected().then((connected) => {
          if (!connected) finish(false);
        });
      }, RETURN_GRACE_MS);
    };

    unsubscribe = desktop.auth.onCallback?.((payload: { url?: string }) => {
      console.log('[connect] received auth:callback deep link', payload?.url);
      if (payload?.url?.includes('integrations/callback')) {
        void checkConnected();
      }
    });

    pollTimer = window.setInterval(() => void checkConnected(), CONNECT_POLL_MS);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    signal?.addEventListener('abort', onAbort);

    timeoutId = window.setTimeout(() => {
      console.warn('[connect] desktop flow timed out');
      void checkConnected().then((connected) => {
        if (!connected) finish(false);
      });
    }, CONNECT_TIMEOUT_MS);

    if (signal?.aborted) onAbort();
  });
}

/** Web completion watcher — the popup handle tells us when the user is done. */
function waitForPopupConnect(
  statusKey: IntegrationStatusKey,
  { authUrl, signal }: { authUrl: string; signal?: AbortSignal }
): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const popup = window.open(authUrl, '_blank', 'width=600,height=700');
    if (!popup) {
      reject(new Error('popup-blocked'));
      return;
    }

    let settled = false;

    const finish = (connected: boolean) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollInterval);
      signal?.removeEventListener('abort', onAbort);
      resolve(connected);
    };

    const onAbort = () => {
      popup.close();
      finish(false);
    };

    const pollInterval = window.setInterval(() => {
      if (popup.closed) void isProviderConnected(statusKey).then(finish);
    }, 500);

    signal?.addEventListener('abort', onAbort);
    if (signal?.aborted) onAbort();
  });
}

/**
 * Runs the full "connect this Google integration" flow and resolves once the
 * OAuth attempt has finished so the caller can refetch status. Resolves to
 * `true` if the provider is connected afterwards, `false` otherwise (including
 * when the user cancels).
 *
 * Pass `signal` to cancel — aborting resolves `false` promptly rather than
 * leaving the caller's "Connecting…" state stranded.
 *
 * - Web: opens a popup and resolves once it closes.
 * - Desktop: Google blocks OAuth inside Electron's embedded webview, so the
 *   backend sends the user through the *system browser*. There is no popup
 *   handle to poll, so completion is detected via the `integrations/callback`
 *   deep link and by polling the backend `/status` endpoint.
 */
export async function connectGoogleIntegration(
  provider: GoogleIntegrationProvider,
  options: { signal?: AbortSignal } = {}
): Promise<boolean> {
  const { signal } = options;
  const statusKey = statusKeyFor(provider);
  const desktopMode = isDesktopApp();
  console.log('[connect] start', { provider, desktopMode });
  const alreadyConnected = await isProviderConnected(statusKey);
  const { authUrl } = await connectGoogle(provider);
  console.log('[connect] got authUrl', { provider, alreadyConnected, authUrl });
  const desktop = globalThis.window.desktop;

  if (desktopMode && desktop?.auth?.openExternal) {
    console.log('[connect] opening system browser (desktop flow)');
    void desktop.auth.openExternal(authUrl);
    return waitForDesktopConnect(statusKey, { alreadyConnected, desktop, signal });
  }

  return waitForPopupConnect(statusKey, { authUrl, signal });
}

/**
 * Start the Slack install ("Add to Slack"). Same two-mode completion handling as
 * the Google flow — popup on web, system browser + deep link on desktop.
 */
export async function connectSlackIntegration(
  options: { signal?: AbortSignal } = {}
): Promise<boolean> {
  const { signal } = options;
  const desktopMode = isDesktopApp();

  const response = await apiFetch('/api/integrations/slack/connect', {
    method: 'POST',
    body: JSON.stringify({ source: desktopMode ? 'desktop' : undefined }),
  });

  if (!response.ok) {
    // The server tells us exactly what is missing from its Slack app config;
    // surfacing that beats a generic failure the user cannot act on.
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      configIssues?: string[];
    };
    throw new Error(
      [body.error ?? 'Failed to start Slack install', ...(body.configIssues ?? [])].join(' ')
    );
  }

  const { authUrl } = (await response.json()) as { authUrl: string };
  const alreadyConnected = await isProviderConnected('slack');
  const desktop = globalThis.window.desktop;

  if (desktopMode && desktop?.auth?.openExternal) {
    void desktop.auth.openExternal(authUrl);
    return waitForDesktopConnect('slack', { alreadyConnected, desktop, signal });
  }

  return waitForPopupConnect('slack', { authUrl, signal });
}

export interface SlackChannel {
  id: string;
  name: string;
}

export async function getSlackChannels(): Promise<SlackChannel[]> {
  const response = await apiFetch('/api/integrations/slack/channels', { method: 'GET' });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Failed to list Slack channels');
  }
  const { channels } = (await response.json()) as { channels: SlackChannel[] };
  return channels;
}

export interface SlackPreferences {
  defaultChannelId: string | null;
  defaultChannelName: string | null;
  /** Post the summary to the default channel when a meeting finishes processing. */
  autoPost: boolean;
}

export async function getSlackPreferences(): Promise<SlackPreferences> {
  const response = await apiFetch('/api/integrations/slack/preferences', { method: 'GET' });
  if (!response.ok) throw new Error('Failed to load Slack preferences');
  return (await response.json()) as SlackPreferences;
}

export async function saveSlackPreferences(
  prefs: Partial<SlackPreferences>
): Promise<SlackPreferences> {
  const response = await apiFetch('/api/integrations/slack/preferences', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Failed to save Slack preferences');
  }
  return (await response.json()) as SlackPreferences;
}

/** Uninstall the Slack app for this user. */
export async function disconnectSlack(): Promise<{ success: boolean }> {
  const response = await apiFetch('/api/integrations/slack/disconnect', { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to disconnect Slack');
  }
  return (await response.json()) as { success: boolean };
}

/**
 * Disconnect a specific Google integration (Calendar or Gmail).
 */
export async function disconnectGoogle(
  provider: GoogleIntegrationProvider
): Promise<{ success: boolean }> {
  const response = await apiFetch('/api/integrations/google/disconnect', {
    method: 'DELETE',
    body: JSON.stringify({ provider }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to disconnect Google integration');
  }
  
  return (await response.json()) as { success: boolean };
}

/**
 * Fetch calendar events
 */
export async function getCalendarEvents(
  startDate?: Date,
  endDate?: Date,
  maxResults?: number
): Promise<{ events: CalendarEvent[] }> {
  const params = new URLSearchParams();
  
  if (startDate) {
    params.append('startDate', startDate.toISOString());
  }
  
  if (endDate) {
    params.append('endDate', endDate.toISOString());
  }
  
  if (maxResults) {
    params.append('maxResults', maxResults.toString());
  }
  
  const url = `/api/integrations/calendar/events${params.toString() ? `?${params.toString()}` : ''}`;
  
  const response = await apiFetch(url, {
    method: 'GET',
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Calendar integration not connected');
    }
    throw new Error('Failed to fetch calendar events');
  }
  
  return (await response.json()) as { events: CalendarEvent[] };
}

/**
 * Get a single calendar event
 */
export async function getCalendarEvent(eventId: string): Promise<{ event: CalendarEvent }> {
  const response = await apiFetch(`/api/integrations/calendar/events/${eventId}`, {
    method: 'GET',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch calendar event');
  }
  
  return (await response.json()) as { event: CalendarEvent };
}

/**
 * Send an email via Gmail
 */
export async function sendEmail(emailData: {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  meetingId?: string;
}): Promise<{ success: boolean; messageId: string; threadId: string }> {
  const response = await apiFetch('/api/integrations/gmail/send', {
    method: 'POST',
    body: JSON.stringify(emailData),
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Gmail integration not connected');
    }
    throw new Error('Failed to send email');
  }
  
  return (await response.json()) as { success: boolean; messageId: string; threadId: string };
}

/**
 * Create a draft email
 */
export async function draftEmail(emailData: {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
}): Promise<{ success: boolean; draftId: string }> {
  const response = await apiFetch('/api/integrations/gmail/draft', {
    method: 'POST',
    body: JSON.stringify(emailData),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create draft email');
  }
  
  return (await response.json()) as { success: boolean; draftId: string };
}

/**
 * Search Gmail messages
 */
export async function searchEmails(
  query: string,
  maxResults?: number
): Promise<{
  messages: Array<{
    id: string;
    threadId: string;
    snippet: string;
  }>;
}> {
  const params = new URLSearchParams();
  params.append('q', query);
  
  if (maxResults) {
    params.append('maxResults', maxResults.toString());
  }
  
  const response = await apiFetch(`/api/integrations/gmail/search?${params.toString()}`, {
    method: 'GET',
  });
  
  if (!response.ok) {
    throw new Error('Failed to search emails');
  }
  
  return (await response.json()) as {
    messages: Array<{ id: string; threadId: string; snippet: string }>;
  };
}

/**
 * Get an email thread
 */
export async function getEmailThread(threadId: string): Promise<{
  thread: {
    id: string;
    snippet: string;
    messages: Array<{
      from: string;
      to: string;
      subject: string;
      body: string;
      date: string;
    }>;
  };
}> {
  const response = await apiFetch(`/api/integrations/gmail/threads/${threadId}`, {
    method: 'GET',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch email thread');
  }
  
  return (await response.json()) as {
    thread: {
      id: string;
      snippet: string;
      messages: Array<{
        from: string;
        to: string;
        subject: string;
        body: string;
        date: string;
      }>;
    };
  };
}
