/**
 * Google OAuth Service
 * 
 * Handles OAuth flow and token management for Google integrations
 * (Calendar, Gmail, etc.)
 */

import { OAuth2Client } from 'google-auth-library';
import type { IntegrationProvider } from '@prisma/client';
import prisma from '../../lib/prisma.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_INTEGRATIONS_REDIRECT_URI || 
  'http://localhost:3001/api/integrations/google/callback';

// Define scopes for each integration type
const SCOPES_MAP: Record<string, string[]> = {
  GOOGLE_CALENDAR: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  GMAIL: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
  ],
};

export class GoogleOAuthService {
  private oauth2Client: OAuth2Client;
  
  constructor() {
    this.oauth2Client = new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );
  }
  
  /**
   * Generate authorization URL for Google OAuth flow
   * Includes scopes for both Calendar and Gmail
   */
  generateAuthUrl(userId: string, providers: IntegrationProvider[]): string {
    // Collect all required scopes
    const scopes = new Set<string>();
    
    for (const provider of providers) {
      const providerScopes = SCOPES_MAP[provider];
      if (providerScopes) {
        providerScopes.forEach(scope => scopes.add(scope));
      }
    }
    
    // Add email and profile for user info
    scopes.add('https://www.googleapis.com/auth/userinfo.email');
    scopes.add('https://www.googleapis.com/auth/userinfo.profile');
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: Array.from(scopes),
      state: JSON.stringify({ userId, providers }),
      prompt: 'consent', // Force consent screen to get refresh token
    });
    
    return authUrl;
  }
  
  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }
    
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: tokens.expiry_date 
        ? new Date(tokens.expiry_date) 
        : new Date(Date.now() + 3600 * 1000), // Default 1 hour
      scope: tokens.scope,
    };
  }
  
  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string) {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });
    
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }
    
    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || refreshToken, // Reuse old one if not provided
      expiresAt: credentials.expiry_date 
        ? new Date(credentials.expiry_date) 
        : new Date(Date.now() + 3600 * 1000),
    };
  }
  
  /**
   * Revoke Google OAuth tokens
   */
  async revokeToken(accessToken: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(accessToken);
    } catch (error) {
      console.error('Error revoking Google token:', error);
      // Don't throw - we still want to mark as disconnected locally
    }
  }
  
  /**
   * Get user info from Google
   */
  async getUserInfo(accessToken: string) {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    
    const userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
    const response = await fetch(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user info from Google');
    }
    
    const data = await response.json();
    
    return {
      email: data.email as string,
      name: data.name as string,
      picture: data.picture as string,
    };
  }
  
  /**
   * Save integration to database
   */
  async saveIntegration(
    userId: string,
    provider: IntegrationProvider,
    accessToken: string,
    refreshToken: string | null,
    expiresAt: Date,
    scopes: string[]
  ) {
    return await prisma.integration.upsert({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      create: {
        userId,
        provider,
        accessToken,
        refreshToken,
        tokenExpiry: expiresAt,
        scopes,
        isActive: true,
      },
      update: {
        accessToken,
        refreshToken,
        tokenExpiry: expiresAt,
        scopes,
        isActive: true,
        lastSyncAt: new Date(),
      },
    });
  }
  
  /**
   * Determine which providers are authorized based on granted scopes
   */
  getAuthorizedProviders(grantedScopes?: string): IntegrationProvider[] {
    if (!grantedScopes) {
      return [];
    }
    
    const scopeSet = new Set(grantedScopes.split(' '));
    const authorized: IntegrationProvider[] = [];
    
    // Check if Calendar scopes are present
    const calendarScopes = SCOPES_MAP.GOOGLE_CALENDAR;
    if (calendarScopes.some(scope => scopeSet.has(scope))) {
      authorized.push('GOOGLE_CALENDAR');
    }
    
    // Check if Gmail scopes are present
    const gmailScopes = SCOPES_MAP.GMAIL;
    if (gmailScopes.some(scope => scopeSet.has(scope))) {
      authorized.push('GMAIL');
    }
    
    return authorized;
  }
}

// Export singleton instance
export const googleOAuthService = new GoogleOAuthService();
