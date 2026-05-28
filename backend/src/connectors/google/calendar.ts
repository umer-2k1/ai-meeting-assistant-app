/**
 * Google Calendar Connector
 * 
 * Handles Google Calendar API integration
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { IntegrationProvider } from '@prisma/client';
import { BaseConnector, type ConnectorConfig, type ConnectorStatus, type TokenRefreshResult } from '../base-connector.js';
import { googleOAuthService } from './oauth.js';
import { ConnectorManager } from '../connector-manager.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
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

export class GoogleCalendarConnector extends BaseConnector {
  private oauth2Client: OAuth2Client;
  private calendar: ReturnType<typeof google.calendar>;
  
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
    
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }
  
  getProvider(): IntegrationProvider {
    return 'GOOGLE_CALENDAR';
  }
  
  async isConnected(): Promise<boolean> {
    try {
      if (!this.config.accessToken) {
        return false;
      }
      
      // Try to list calendars to verify connection
      await this.calendar.calendarList.list({ maxResults: 1 });
      return true;
    } catch (error) {
      console.error('Google Calendar connection check failed:', error);
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
      
      // Get user's primary calendar email
      const calendar = await this.calendar.calendars.get({ calendarId: 'primary' });
      
      return {
        connected: true,
        provider: this.getProvider(),
        email: calendar.data.id || undefined,
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
      throw new Error('No refresh token available for Google Calendar');
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
   * List calendar events within a date range
   */
  async listEvents(
    startDate: Date,
    endDate: Date,
    maxResults = 50
  ): Promise<CalendarEvent[]> {
    await this.ensureValidToken();
    
    const response = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = response.data.items || [];
    
    return events.map(event => this.mapGoogleEventToCalendarEvent(event));
  }
  
  /**
   * Get a single event by ID
   */
  async getEvent(eventId: string): Promise<CalendarEvent> {
    await this.ensureValidToken();
    
    const response = await this.calendar.events.get({
      calendarId: 'primary',
      eventId,
    });
    
    return this.mapGoogleEventToCalendarEvent(response.data);
  }
  
  /**
   * Create a new calendar event
   */
  async createEvent(eventData: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    attendees?: string[];
  }): Promise<CalendarEvent> {
    await this.ensureValidToken();
    
    const response = await this.calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: eventData.startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: eventData.endTime.toISOString(),
          timeZone: 'UTC',
        },
        location: eventData.location,
        attendees: eventData.attendees?.map(email => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
      conferenceDataVersion: 1,
    });
    
    return this.mapGoogleEventToCalendarEvent(response.data);
  }
  
  /**
   * Update an existing event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<{
      title: string;
      description: string;
      startTime: Date;
      endTime: Date;
      location: string;
    }>
  ): Promise<CalendarEvent> {
    await this.ensureValidToken();
    
    const requestBody: any = {};
    
    if (updates.title) requestBody.summary = updates.title;
    if (updates.description) requestBody.description = updates.description;
    if (updates.startTime) {
      requestBody.start = {
        dateTime: updates.startTime.toISOString(),
        timeZone: 'UTC',
      };
    }
    if (updates.endTime) {
      requestBody.end = {
        dateTime: updates.endTime.toISOString(),
        timeZone: 'UTC',
      };
    }
    if (updates.location) requestBody.location = updates.location;
    
    const response = await this.calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody,
    });
    
    return this.mapGoogleEventToCalendarEvent(response.data);
  }
  
  /**
   * Map Google Calendar API event to our CalendarEvent format
   */
  private mapGoogleEventToCalendarEvent(event: any): CalendarEvent {
    const startTime = event.start?.dateTime 
      ? new Date(event.start.dateTime)
      : new Date(event.start?.date || Date.now());
    
    const endTime = event.end?.dateTime
      ? new Date(event.end.dateTime)
      : new Date(event.end?.date || Date.now());
    
    // Extract Google Meet link
    const meetLink = event.hangoutLink || 
      event.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri;
    
    return {
      id: event.id,
      title: event.summary || '(No title)',
      description: event.description,
      startTime,
      endTime,
      location: event.location,
      attendees: event.attendees?.map((a: any) => ({
        email: a.email,
        name: a.displayName,
        responseStatus: a.responseStatus,
      })),
      meetLink,
      status: event.status,
      recurring: !!event.recurringEventId,
    };
  }
}
