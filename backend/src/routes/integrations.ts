/**
 * Integrations API Routes
 * 
 * Handles OAuth flow, connection management, and integration features
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { googleOAuthService, getIntegrationsOAuthConfigIssues, GOOGLE_INTEGRATIONS_REDIRECT_URI } from '../connectors/google/oauth.js';
import { ConnectorManager } from '../connectors/connector-manager.js';
import prisma from '../lib/prisma.js';
import {
  buildIntegrationConnectedPage,
  buildIntegrationErrorPage,
  buildDesktopIntegrationRedirectPage,
} from '../lib/integration-callback-page.js';
import type { IntegrationProvider } from '@prisma/client';

const router = express.Router();
const DESKTOP_PROTOCOL = process.env.DESKTOP_PROTOCOL || 'ai-meeting-copilot';

const GOOGLE_INTEGRATIONS_SETUP = {
  redirectUri: GOOGLE_INTEGRATIONS_REDIRECT_URI,
  loginRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback',
  googleCloudConsoleSteps: [
    'Open Google Cloud Console → APIs & Services → Library → enable "Google Calendar API" (and "Gmail API" for Gmail).',
    'OAuth consent screen → Scopes → add ".../auth/calendar.readonly" (and Gmail scopes if needed).',
    'OAuth consent screen → Test users → add the Google account you sign in with.',
    'Credentials → OAuth 2.0 Client → Authorized redirect URIs must include BOTH:',
    '  • http://localhost:3001/auth/google/callback (login)',
    '  • http://localhost:3001/api/integrations/google/callback (integrations)',
    'Use exact URLs — no trailing slash. Changes can take 1–2 minutes to apply.',
  ],
};

/**
 * GET /api/integrations/status
 * Get connection status for all integrations
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const integrations = await ConnectorManager.getUserIntegrations(userId);
    console.log('[integrations:status] active integrations for user', {
      userId,
      providers: integrations.map((i) => i.provider),
    });
    
    const status: Record<string, any> = {
      calendar: { connected: false },
      gmail: { connected: false },
      slack: { connected: false },
    };
    
    for (const integration of integrations) {
      if (integration.provider === 'GOOGLE_CALENDAR') {
        try {
          const connector = await ConnectorManager.getConnector(userId, 'GOOGLE_CALENDAR');
          const connectorStatus = await connector.getStatus();
          console.log('[integrations:status] calendar connector status', connectorStatus);
          status.calendar = {
            connected: connectorStatus.connected,
            email: connectorStatus.email,
            lastSync: integration.lastSyncAt,
          };
        } catch (error) {
          console.error('[integrations:status] Error getting calendar status:', error);
        }
      } else if (integration.provider === 'GMAIL') {
        try {
          const connector = await ConnectorManager.getConnector(userId, 'GMAIL');
          const connectorStatus = await connector.getStatus();
          console.log('[integrations:status] gmail connector status', connectorStatus);
          status.gmail = {
            connected: connectorStatus.connected,
            email: connectorStatus.email,
            lastSync: integration.lastSyncAt,
          };
        } catch (error) {
          console.error('[integrations:status] Error getting gmail status:', error);
        }
      }
    }
    
    console.log('[integrations:status] responding', status);
    res.json(status);
  } catch (error) {
    console.error('Error getting integration status:', error);
    res.status(500).json({ error: 'Failed to get integration status' });
  }
});

const VALID_PROVIDERS: IntegrationProvider[] = ['GOOGLE_CALENDAR', 'GMAIL'];

function parseRequestedProviders(input: unknown): IntegrationProvider[] {
  const raw = Array.isArray(input) ? input : input ? [input] : [];
  const providers = raw
    .map((value) => String(value).toUpperCase())
    .filter((value): value is IntegrationProvider =>
      VALID_PROVIDERS.includes(value as IntegrationProvider)
    );

  // De-duplicate while preserving order
  return Array.from(new Set(providers));
}

/**
 * GET /api/integrations/google/setup
 * Returns OAuth redirect URI + Google Cloud Console checklist for debugging connect issues.
 */
router.get('/google/setup', requireAuth, (_req, res) => {
  res.json({
    ...GOOGLE_INTEGRATIONS_SETUP,
    configIssues: getIntegrationsOAuthConfigIssues(),
  });
});

/**
 * POST /api/integrations/google/connect
 * Initiate Google OAuth flow for a specific provider (Calendar or Gmail).
 * Body: { provider: 'GOOGLE_CALENDAR' | 'GMAIL' } or { providers: [...] }
 * Defaults to Calendar only if nothing valid is provided, so each
 * integration's "Connect" button only ever requests its own scopes.
 */
router.post('/google/connect', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const requested = parseRequestedProviders(req.body?.providers ?? req.body?.provider);
    const providers: IntegrationProvider[] = requested.length > 0 ? requested : ['GOOGLE_CALENDAR'];
    const isDesktop = req.body?.source === 'desktop';

    console.log('[integrations:connect] request', {
      userId,
      body: req.body,
      resolvedProviders: providers,
      isDesktop,
    });

    const authUrl = googleOAuthService.generateAuthUrl(userId, providers, {
      isDesktop,
      loginHint: req.user!.email,
    });

    console.log('[integrations:connect] generated authUrl', authUrl);

    res.json({
      authUrl,
      redirectUri: GOOGLE_INTEGRATIONS_REDIRECT_URI,
      configIssues: getIntegrationsOAuthConfigIssues(),
      setup: GOOGLE_INTEGRATIONS_SETUP.googleCloudConsoleSteps,
    });
  } catch (error) {
    console.error('[integrations:connect] Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

/**
 * Renders the right callback page depending on where the OAuth flow started:
 * - Web: this route runs inside a popup window (see settings-screen.tsx /
 *   calendar-screen.tsx). The opener polls `popup.closed` and refreshes its
 *   own state, so we just give feedback here and close the popup.
 * - Desktop: Electron forces Google OAuth to open in the system browser
 *   (embedded webviews are blocked by Google), so there is no popup handle
 *   for the app to poll. Instead we redirect the browser tab to a custom
 *   protocol deep link that the Electron app catches, and the renderer
 *   refreshes its integration status when it receives that deep link.
 */
function sendIntegrationCallbackResult(
  res: express.Response,
  isDesktop: boolean,
  result: { success: true; providers: IntegrationProvider[] } | { success: false; reason?: string }
) {
  if (isDesktop) {
    const params = new URLSearchParams();
    if (result.success) {
      params.set('status', 'connected');
      params.set('providers', result.providers.join(','));
    } else {
      params.set('status', 'error');
      if (result.reason) params.set('reason', result.reason);
    }
    const deepLink = `${DESKTOP_PROTOCOL}://integrations/callback?${params.toString()}`;
    res.type('html').send(buildDesktopIntegrationRedirectPage(deepLink, result.success));
    return;
  }

  if (result.success) {
    res.type('html').send(buildIntegrationConnectedPage(result.providers));
  } else {
    res.type('html').send(buildIntegrationErrorPage(result.reason));
  }
}

/**
 * GET /api/integrations/google/callback
 * OAuth callback handler
 */
router.get('/google/callback', async (req, res) => {
  const rawState = req.query.state as string | undefined;
  let isDesktop = false;
  try {
    if (rawState) {
      isDesktop = Boolean(JSON.parse(rawState)?.isDesktop);
    }
  } catch {
    // Malformed state - fall through to the generic error handling below.
  }

  console.log('[integrations:callback] hit', {
    hasCode: Boolean(req.query.code),
    hasState: Boolean(rawState),
    oauthError: req.query.error ?? null,
    isDesktop,
  });

  try {
    const code = req.query.code as string | undefined;
    const oauthError = req.query.error as string | undefined;

    if (oauthError) {
      // User denied the consent screen (e.g. clicked "Cancel")
      console.warn('[integrations:callback] OAuth returned error param:', oauthError);
      sendIntegrationCallbackResult(res, isDesktop, {
        success: false,
        reason: 'You did not grant access, so nothing was connected.',
      });
      return;
    }

    if (!code || !rawState) {
      console.warn('[integrations:callback] missing code or state');
      res.status(400);
      sendIntegrationCallbackResult(res, isDesktop, {
        success: false,
        reason: 'Missing authorization code or state.',
      });
      return;
    }

    // Parse state to get userId and providers
    const parsedState = JSON.parse(rawState);
    const { userId } = parsedState;
    console.log('[integrations:callback] parsed state', parsedState);

    // Exchange code for tokens
    const tokens = await googleOAuthService.exchangeCodeForTokens(code);
    console.log('[integrations:callback] exchanged tokens', {
      hasAccessToken: Boolean(tokens.accessToken),
      hasRefreshToken: Boolean(tokens.refreshToken),
      grantedScopes: tokens.scope,
      expiresAt: tokens.expiresAt,
    });

    // Determine which providers were authorized based on granted scopes
    const authorizedProviders = googleOAuthService.getAuthorizedProviders(tokens.scope);
    console.log('[integrations:callback] authorized providers', authorizedProviders);

    // Save integrations to database
    for (const provider of authorizedProviders) {
      const saved = await googleOAuthService.saveIntegration(
        userId,
        provider,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresAt,
        tokens.scope?.split(' ') || []
      );
      console.log('[integrations:callback] saved integration', {
        userId,
        provider,
        integrationId: saved.id,
        isActive: saved.isActive,
      });
    }

    if (authorizedProviders.length === 0) {
      console.warn('[integrations:callback] no providers authorized from granted scopes; nothing saved');
    }

    sendIntegrationCallbackResult(res, isDesktop, { success: true, providers: authorizedProviders });
  } catch (error) {
    console.error('[integrations:callback] OAuth callback error:', error);
    sendIntegrationCallbackResult(res, isDesktop, { success: false });
  }
});

/**
 * DELETE /api/integrations/google/disconnect
 * Disconnect a specific Google integration (Calendar or Gmail).
 * Query/body: { provider: 'GOOGLE_CALENDAR' | 'GMAIL' } or { providers: [...] }
 * Falls back to disconnecting both if none is specified, for backward compatibility.
 */
router.delete('/google/disconnect', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const requested = parseRequestedProviders(
      req.body?.providers ?? req.body?.provider ?? req.query?.providers ?? req.query?.provider
    );
    const providers: IntegrationProvider[] = requested.length > 0 ? requested : VALID_PROVIDERS;

    for (const provider of providers) {
      try {
        const connector = await ConnectorManager.getConnector(userId, provider);
        await connector.disconnect();
      } catch (error) {
        // Integration might not be connected, continue
        console.log(`Integration ${provider} not connected or already disconnected`);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Google integrations:', error);
    res.status(500).json({ error: 'Failed to disconnect integrations' });
  }
});

/**
 * GET /api/integrations/calendar/events
 * Fetch calendar events
 */
router.get('/calendar/events', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Parse query parameters
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string) 
      : new Date();
    
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate as string) 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    const maxResults = req.query.maxResults 
      ? parseInt(req.query.maxResults as string, 10) 
      : 50;
    
    // Get calendar connector
    const connector = await ConnectorManager.getConnector(userId, 'GOOGLE_CALENDAR');
    const calendarConnector = connector as any; // Cast to access calendar-specific methods
    
    // Fetch events
    const events = await calendarConnector.listEvents(startDate, endDate, maxResults);
    
    res.json({ events });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    
    if (error instanceof Error && error.message.includes('not found or inactive')) {
      return res.status(404).json({ error: 'Calendar integration not connected' });
    }
    
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

/**
 * GET /api/integrations/calendar/events/:eventId
 * Get single calendar event
 */
router.get('/calendar/events/:eventId', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const eventId = req.params.eventId;
    
    const connector = await ConnectorManager.getConnector(userId, 'GOOGLE_CALENDAR');
    const calendarConnector = connector as any;
    
    const event = await calendarConnector.getEvent(eventId);
    
    res.json({ event });
  } catch (error) {
    console.error('Error fetching calendar event:', error);
    res.status(500).json({ error: 'Failed to fetch calendar event' });
  }
});

/**
 * POST /api/integrations/gmail/send
 * Send an email via Gmail
 */
router.post('/gmail/send', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { to, subject, body, html, cc, bcc, meetingId } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }
    
    // Get Gmail connector
    const connector = await ConnectorManager.getConnector(userId, 'GMAIL');
    const gmailConnector = connector as any;
    
    // Send email
    const result = await gmailConnector.sendEmail({
      to,
      subject,
      body,
      html,
      cc,
      bcc,
    });
    
    // Log integration action
    if (meetingId) {
      await prisma.integrationLog.create({
        data: {
          entityType: 'meeting',
          entityId: meetingId,
          integrationType: 'EMAIL',
          destination: Array.isArray(to) ? to.join(', ') : to,
          status: 'success',
          metadata: {
            messageId: result.id,
            threadId: result.threadId,
          },
        },
      });
    }
    
    res.json({ success: true, messageId: result.id, threadId: result.threadId });
  } catch (error) {
    console.error('Error sending email:', error);
    
    if (error instanceof Error && error.message.includes('not found or inactive')) {
      return res.status(404).json({ error: 'Gmail integration not connected' });
    }
    
    res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * POST /api/integrations/gmail/draft
 * Create a draft email
 */
router.post('/gmail/draft', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { to, subject, body, html, cc, bcc } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }
    
    const connector = await ConnectorManager.getConnector(userId, 'GMAIL');
    const gmailConnector = connector as any;
    
    const result = await gmailConnector.draftEmail({
      to,
      subject,
      body,
      html,
      cc,
      bcc,
    });
    
    res.json({ success: true, draftId: result.id });
  } catch (error) {
    console.error('Error creating draft:', error);
    res.status(500).json({ error: 'Failed to create draft' });
  }
});

/**
 * GET /api/integrations/gmail/threads/:threadId
 * Get an email thread
 */
router.get('/gmail/threads/:threadId', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const threadId = req.params.threadId;
    
    const connector = await ConnectorManager.getConnector(userId, 'GMAIL');
    const gmailConnector = connector as any;
    
    const thread = await gmailConnector.getThread(threadId);
    
    res.json({ thread });
  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ error: 'Failed to fetch email thread' });
  }
});

/**
 * GET /api/integrations/gmail/search
 * Search emails
 */
router.get('/gmail/search', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const query = req.query.q as string;
    const maxResults = req.query.maxResults 
      ? parseInt(req.query.maxResults as string, 10) 
      : 20;
    
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }
    
    const connector = await ConnectorManager.getConnector(userId, 'GMAIL');
    const gmailConnector = connector as any;
    
    const messages = await gmailConnector.searchMessages(query, maxResults);
    
    res.json({ messages });
  } catch (error) {
    console.error('Error searching emails:', error);
    res.status(500).json({ error: 'Failed to search emails' });
  }
});

export default router;
