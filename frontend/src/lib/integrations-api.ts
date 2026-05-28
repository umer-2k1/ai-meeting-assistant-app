/**
 * Integrations API Client
 * 
 * Frontend API client for managing integrations
 */

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

/**
 * Initiate Google OAuth flow
 * Returns the authorization URL to redirect the user to
 */
export async function connectGoogle(): Promise<{ authUrl: string }> {
  const response = await apiFetch('/api/integrations/google/connect', {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error('Failed to initiate Google OAuth flow');
  }
  
  return (await response.json()) as { authUrl: string };
}

/**
 * Disconnect Google integrations (Calendar & Gmail)
 */
export async function disconnectGoogle(): Promise<{ success: boolean }> {
  const response = await apiFetch('/api/integrations/google/disconnect', {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to disconnect Google integrations');
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
