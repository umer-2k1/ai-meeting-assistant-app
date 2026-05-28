/**
 * Integrations API Routes
 * 
 * Handles OAuth flow, connection management, and integration features
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { googleOAuthService } from '../connectors/google/oauth.js';
import { ConnectorManager } from '../connectors/connector-manager.js';
import prisma from '../lib/prisma.js';
import type { IntegrationProvider } from '@prisma/client';

const router = express.Router();

/**
 * GET /api/integrations/status
 * Get connection status for all integrations
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const integrations = await ConnectorManager.getUserIntegrations(userId);
    
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
          status.calendar = {
            connected: connectorStatus.connected,
            email: connectorStatus.email,
            lastSync: integration.lastSyncAt,
          };
        } catch (error) {
          console.error('Error getting calendar status:', error);
        }
      } else if (integration.provider === 'GMAIL') {
        try {
          const connector = await ConnectorManager.getConnector(userId, 'GMAIL');
          const connectorStatus = await connector.getStatus();
          status.gmail = {
            connected: connectorStatus.connected,
            email: connectorStatus.email,
            lastSync: integration.lastSyncAt,
          };
        } catch (error) {
          console.error('Error getting gmail status:', error);
        }
      }
    }
    
    res.json(status);
  } catch (error) {
    console.error('Error getting integration status:', error);
    res.status(500).json({ error: 'Failed to get integration status' });
  }
});

/**
 * POST /api/integrations/google/connect
 * Initiate Google OAuth flow for Calendar and Gmail
 */
router.post('/google/connect', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const providers: IntegrationProvider[] = ['GOOGLE_CALENDAR', 'GMAIL'];
    const authUrl = googleOAuthService.generateAuthUrl(userId, providers);
    
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

/**
 * GET /api/integrations/google/callback
 * OAuth callback handler
 */
router.get('/google/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    
    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter');
    }
    
    // Parse state to get userId and providers
    const { userId, providers } = JSON.parse(state);
    
    // Exchange code for tokens
    const tokens = await googleOAuthService.exchangeCodeForTokens(code);
    
    // Determine which providers were authorized based on granted scopes
    const authorizedProviders = googleOAuthService.getAuthorizedProviders(tokens.scope);
    
    // Save integrations to database
    for (const provider of authorizedProviders) {
      await googleOAuthService.saveIntegration(
        userId,
        provider,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresAt,
        tokens.scope?.split(' ') || []
      );
    }
    
    // Redirect to frontend settings page with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/settings?tab=integrations&status=connected`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/settings?tab=integrations&status=error`);
  }
});

/**
 * DELETE /api/integrations/google/disconnect
 * Disconnect Google integrations (Calendar & Gmail)
 */
router.delete('/google/disconnect', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Disconnect both Calendar and Gmail
    const providers: IntegrationProvider[] = ['GOOGLE_CALENDAR', 'GMAIL'];
    
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
