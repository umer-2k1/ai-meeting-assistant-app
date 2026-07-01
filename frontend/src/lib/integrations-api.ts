/**
 * Integrations API Client
 * 
 * Frontend API client for managing integrations
 */

import { isDesktopApp } from './google-auth';

const BACKEND_URL = import.meta.env['VITE_BACKEND_URL'] || 'http://localhost:3001';
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

export interface IntegrationStatus {
  calendar: {
    connected: boolean;
    email?: string;
    lastSync?: string;
  };
  gmail: {
    connected: boolean;
    email?: string;
    lastSync?: string;
  };
  slack: {
    connected: boolean;
    email?: string;
    lastSync?: string;
  };
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

function statusKeyFor(provider: GoogleIntegrationProvider): 'calendar' | 'gmail' {
  return provider === 'GMAIL' ? 'gmail' : 'calendar';
}

async function isProviderConnected(provider: GoogleIntegrationProvider): Promise<boolean> {
  try {
    const status = await getIntegrationStatus();
    const connected = Boolean(status[statusKeyFor(provider)]?.connected);
    console.log('[connect] status poll', { provider, connected, status });
    return connected;
  } catch (error) {
    console.warn('[connect] status poll failed', error);
    return false;
  }
}

/**
 * Runs the full "connect this Google integration" flow and resolves once the
 * OAuth attempt has finished so the caller can refetch status. Resolves to
 * `true` if the provider is connected afterwards, `false` otherwise.
 *
 * - Web: opens a popup and resolves once it closes.
 * - Desktop: Google blocks OAuth inside Electron's embedded webview, so the
 *   backend sends the user through the *system browser*. There is no popup
 *   handle to poll, so we detect completion two ways (whichever fires first):
 *     1. Fast path: a custom-protocol deep link (`ai-meeting-copilot://
 *        integrations/callback`) that the Electron main process forwards to
 *        the renderer as an `auth:callback` IPC event.
 *     2. Reliable path: polling the backend `/status` endpoint until the
 *        provider shows connected. This works even if the Electron main
 *        process wasn't restarted to recognize the new deep link.
 */
export async function connectGoogleIntegration(provider: GoogleIntegrationProvider): Promise<boolean> {
  const desktopMode = isDesktopApp();
  console.log('[connect] start', { provider, desktopMode });
  const alreadyConnected = await isProviderConnected(provider);
  const { authUrl } = await connectGoogle(provider);
  console.log('[connect] got authUrl', { provider, alreadyConnected, authUrl });
  const desktop = globalThis.window.desktop;

  if (desktopMode && desktop?.auth?.openExternal) {
    console.log('[connect] opening system browser (desktop flow)');
    void desktop.auth.openExternal(authUrl);

    return new Promise<boolean>((resolve) => {
      let settled = false;
      let unsubscribe: (() => void) | undefined;
      let pollTimer: number | undefined;
      let timeoutId: number | undefined;

      const finish = (connected: boolean) => {
        if (settled) return;
        settled = true;
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        if (pollTimer !== undefined) window.clearInterval(pollTimer);
        unsubscribe?.();
        console.log('[connect] desktop flow finished', { provider, connected });
        resolve(connected);
      };

      // Fast path: deep link from Electron. Confirm with a status check.
      unsubscribe = desktop.auth.onCallback?.((payload: { url?: string }) => {
        console.log('[connect] received auth:callback deep link', payload?.url);
        if (payload?.url?.includes('integrations/callback')) {
          void isProviderConnected(provider).then(finish);
        }
      });

      // Reliable path: poll the backend until the provider connects. If it was
      // already connected before we started, wait for lastSync to change is
      // overkill — just resolve on the first positive read after a short delay.
      let firstTick = true;
      pollTimer = window.setInterval(() => {
        void isProviderConnected(provider).then((connected) => {
          // Skip the very first read if it was already connected, so a reconnect
          // doesn't resolve before the user finishes in the browser.
          if (firstTick) {
            firstTick = false;
            if (connected && alreadyConnected) return;
          }
          if (connected) finish(true);
        });
      }, 2000);

      // Don't leave the caller hanging forever if the user abandons the flow.
      timeoutId = window.setTimeout(() => {
        console.warn('[connect] desktop flow timed out after 3 minutes');
        void isProviderConnected(provider).then(finish);
      }, 3 * 60 * 1000);
    });
  }

  return new Promise<boolean>((resolve, reject) => {
    const popup = window.open(authUrl, '_blank', 'width=600,height=700');
    if (!popup) {
      reject(new Error('popup-blocked'));
      return;
    }

    const pollInterval = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(pollInterval);
        void isProviderConnected(provider).then(resolve);
      }
    }, 500);
  });
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
