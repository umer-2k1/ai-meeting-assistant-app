/**
 * Gmail Connector
 * 
 * Handles Gmail API integration for sending and reading emails
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { IntegrationProvider } from '@prisma/client';
import { BaseConnector, type ConnectorConfig, type ConnectorStatus, type TokenRefreshResult } from '../base-connector.js';
import { googleOAuthService } from './oauth.js';
import { ConnectorManager } from '../connector-manager.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export interface EmailMessage {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string; // Base64 encoded
    contentType: string;
  }>;
}

export interface EmailThread {
  id: string;
  snippet: string;
  messages: Array<{
    from: string;
    to: string;
    subject: string;
    body: string;
    date: Date;
  }>;
}

export class GmailConnector extends BaseConnector {
  private oauth2Client: OAuth2Client;
  private gmail: ReturnType<typeof google.gmail>;
  
  constructor(config: ConnectorConfig) {
    super(config);
    
    this.oauth2Client = new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    );
    
    this.oauth2Client.setCredentials({
      access_token: config.accessToken || undefined,
      refresh_token: config.refreshToken || undefined,
    });
    
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }
  
  getProvider(): IntegrationProvider {
    return 'GMAIL';
  }
  
  async isConnected(): Promise<boolean> {
    try {
      if (!this.config.accessToken) {
        return false;
      }
      
      // Try to get user profile to verify connection
      await this.gmail.users.getProfile({ userId: 'me' });
      return true;
    } catch (error) {
      console.error('Gmail connection check failed:', error);
      return false;
    }
  }
  
  async getStatus(): Promise<ConnectorStatus> {
    try {
      const connected = await this.isConnected();
      
      if (!connected) {
        return {
          connected: false,
          provider: this.getProvider(),
          error: 'Not connected or token expired',
        };
      }
      
      // Get user's email address
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      
      return {
        connected: true,
        provider: this.getProvider(),
        email: profile.data.emailAddress || undefined,
      };
    } catch (error) {
      return {
        connected: false,
        provider: this.getProvider(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  async refreshTokens(): Promise<TokenRefreshResult> {
    if (!this.config.refreshToken) {
      throw new Error('No refresh token available for Gmail');
    }
    
    const tokens = await googleOAuthService.refreshAccessToken(this.config.refreshToken);
    
    // Update database
    await ConnectorManager.updateTokens(
      this.config.userId,
      this.getProvider(),
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt
    );
    
    // Update local credentials
    this.oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
    
    return tokens;
  }
  
  async disconnect(): Promise<void> {
    if (this.config.accessToken) {
      await googleOAuthService.revokeToken(this.config.accessToken);
    }
    
    await ConnectorManager.disconnectIntegration(
      this.config.userId,
      this.getProvider()
    );
  }
  
  /**
   * Send an email
   */
  async sendEmail(message: EmailMessage): Promise<{ id: string; threadId: string }> {
    await this.ensureValidToken();
    
    const email = this.createMimeMessage(message);
    const encodedEmail = Buffer.from(email).toString('base64url');
    
    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });
    
    return {
      id: response.data.id!,
      threadId: response.data.threadId!,
    };
  }
  
  /**
   * Create a draft email
   */
  async draftEmail(message: EmailMessage): Promise<{ id: string; message: { id: string } }> {
    await this.ensureValidToken();
    
    const email = this.createMimeMessage(message);
    const encodedEmail = Buffer.from(email).toString('base64url');
    
    const response = await this.gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedEmail,
        },
      },
    });
    
    return {
      id: response.data.id!,
      message: {
        id: response.data.message?.id!,
      },
    };
  }
  
  /**
   * Get an email thread
   */
  async getThread(threadId: string): Promise<EmailThread> {
    await this.ensureValidToken();
    
    const response = await this.gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });
    
    const messages = response.data.messages || [];
    
    return {
      id: response.data.id!,
      snippet: response.data.snippet || '',
      messages: messages.map(msg => {
        const headers = msg.payload?.headers || [];
        const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
        const to = headers.find(h => h.name?.toLowerCase() === 'to')?.value || '';
        const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
        const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || '';
        
        return {
          from,
          to,
          subject,
          body: this.extractMessageBody(msg),
          date: date ? new Date(date) : new Date(),
        };
      }),
    };
  }
  
  /**
   * Search for messages
   */
  async searchMessages(query: string, maxResults = 20): Promise<Array<{
    id: string;
    threadId: string;
    snippet: string;
  }>> {
    await this.ensureValidToken();
    
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });
    
    const messages = response.data.messages || [];
    
    return messages.map(msg => ({
      id: msg.id!,
      threadId: msg.threadId!,
      snippet: '', // Snippet not included in list response
    }));
  }
  
  /**
   * Get full message details
   */
  async getMessage(messageId: string): Promise<{
    id: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    date: Date;
  }> {
    await this.ensureValidToken();
    
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    
    const headers = response.data.payload?.headers || [];
    const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
    const to = headers.find(h => h.name?.toLowerCase() === 'to')?.value || '';
    const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
    const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || '';
    
    return {
      id: response.data.id!,
      threadId: response.data.threadId!,
      from,
      to,
      subject,
      body: this.extractMessageBody(response.data),
      date: date ? new Date(date) : new Date(),
    };
  }
  
  /**
   * Create MIME email message
   */
  private createMimeMessage(message: EmailMessage): string {
    const to = Array.isArray(message.to) ? message.to.join(', ') : message.to;
    const cc = message.cc ? (Array.isArray(message.cc) ? message.cc.join(', ') : message.cc) : '';
    const bcc = message.bcc ? (Array.isArray(message.bcc) ? message.bcc.join(', ') : message.bcc) : '';
    
    const boundary = `boundary_${Date.now()}`;
    
    let email = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : '',
      bcc ? `Bcc: ${bcc}` : '',
      `Subject: ${message.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
    ].filter(Boolean).join('\r\n');
    
    // Add plain text body
    email += '\r\n' + [
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      message.body,
      '',
    ].join('\r\n');
    
    // Add HTML body if provided
    if (message.html) {
      email += [
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        message.html,
        '',
      ].join('\r\n');
    }
    
    // Add attachments if provided
    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        email += [
          `--${boundary}`,
          `Content-Type: ${attachment.contentType}`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          '',
          attachment.content,
          '',
        ].join('\r\n');
      }
    }
    
    email += `--${boundary}--`;
    
    return email;
  }
  
  /**
   * Extract plain text body from message
   */
  private extractMessageBody(message: any): string {
    if (!message.payload) {
      return '';
    }
    
    // Check if the message has parts
    if (message.payload.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
      
      // Recursively check nested parts
      for (const part of message.payload.parts) {
        if (part.parts) {
          const body = this.extractMessageBody({ payload: part });
          if (body) return body;
        }
      }
    }
    
    // Check body data directly
    if (message.payload.body?.data) {
      return Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }
    
    return message.snippet || '';
  }
}
