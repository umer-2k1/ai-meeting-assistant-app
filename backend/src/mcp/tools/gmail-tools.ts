/**
 * MCP Gmail Tools
 * 
 * Tool definitions for LLM to interact with Gmail
 */

import type { IntegrationProvider } from '@prisma/client';
import { ConnectorManager } from '../../connectors/connector-manager.js';
import type { McpTool } from './calendar-tools.js';

/**
 * Send a follow-up email after a meeting
 */
export const sendFollowupEmailTool: McpTool = {
  name: 'send_followup_email',
  description: 'Send a follow-up email to meeting attendees with summary and action items',
  parameters: {
    to: {
      type: 'array',
      description: 'Array of recipient email addresses',
      required: true,
    },
    subject: {
      type: 'string',
      description: 'Email subject line',
      required: true,
    },
    body: {
      type: 'string',
      description: 'Email body (plain text)',
      required: true,
    },
    html: {
      type: 'string',
      description: 'Email body (HTML format)',
      required: false,
    },
    cc: {
      type: 'array',
      description: 'Array of CC email addresses',
      required: false,
    },
  },
  async execute(userId: string, params: Record<string, any>) {
    const { to, subject, body, html, cc } = params;
    
    if (!to || !subject || !body) {
      throw new Error('to, subject, and body are required');
    }
    
    const connector = await ConnectorManager.getConnector(userId, 'GMAIL');
    const gmailConnector = connector as any;
    
    const result = await gmailConnector.sendEmail({
      to,
      subject,
      body,
      html,
      cc,
    });
    
    return {
      success: true,
      message_id: result.id,
      thread_id: result.threadId,
      message: 'Email sent successfully',
    };
  },
};

/**
 * Draft an email (doesn't send it)
 */
export const draftEmailTool: McpTool = {
  name: 'draft_email',
  description: 'Create a draft email (not sent automatically)',
  parameters: {
    to: {
      type: 'array',
      description: 'Array of recipient email addresses',
      required: true,
    },
    subject: {
      type: 'string',
      description: 'Email subject line',
      required: true,
    },
    body: {
      type: 'string',
      description: 'Email body (plain text)',
      required: true,
    },
    html: {
      type: 'string',
      description: 'Email body (HTML format)',
      required: false,
    },
  },
  async execute(userId: string, params: Record<string, any>) {
    const { to, subject, body, html } = params;
    
    if (!to || !subject || !body) {
      throw new Error('to, subject, and body are required');
    }
    
    const connector = await ConnectorManager.getConnector(userId, 'GMAIL');
    const gmailConnector = connector as any;
    
    const result = await gmailConnector.draftEmail({
      to,
      subject,
      body,
      html,
    });
    
    return {
      success: true,
      draft_id: result.id,
      message: 'Draft created successfully. User can review and send from Gmail.',
    };
  },
};

/**
 * Search for related emails
 */
export const searchRelatedEmailsTool: McpTool = {
  name: 'search_related_emails',
  description: 'Search Gmail for emails related to a topic, person, or meeting',
  parameters: {
    query: {
      type: 'string',
      description: 'Gmail search query (e.g., "from:john@example.com subject:project")',
      required: true,
    },
    max_results: {
      type: 'number',
      description: 'Maximum number of results to return (default: 10)',
      required: false,
    },
  },
  async execute(userId: string, params: Record<string, any>) {
    const { query, max_results } = params;
    
    if (!query) {
      throw new Error('query is required');
    }
    
    const maxResults = max_results || 10;
    
    const connector = await ConnectorManager.getConnector(userId, 'GMAIL');
    const gmailConnector = connector as any;
    
    const messages = await gmailConnector.searchMessages(query, maxResults);
    
    // Fetch full details for each message
    const detailedMessages = await Promise.all(
      messages.slice(0, 5).map(async (msg: any) => {
        try {
          return await gmailConnector.getMessage(msg.id);
        } catch (error) {
          return null;
        }
      })
    );
    
    return {
      success: true,
      messages: detailedMessages.filter(Boolean).map((msg: any) => ({
        id: msg.id,
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        date: msg.date,
        snippet: msg.body.substring(0, 200),
      })),
      total_found: messages.length,
      message: `Found ${messages.length} matching emails`,
    };
  },
};

// Export all Gmail tools
export const gmailTools = [
  sendFollowupEmailTool,
  draftEmailTool,
  searchRelatedEmailsTool,
];
