/**
 * MCP Calendar Tools
 * 
 * Tool definitions for LLM to interact with Google Calendar
 */

import type { IntegrationProvider } from '@prisma/client';
import { ConnectorManager } from '../../connectors/connector-manager.js';

export interface McpTool {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
  }>;
  execute: (userId: string, params: Record<string, any>) => Promise<any>;
}

/**
 * List upcoming meetings from calendar
 */
export const listUpcomingMeetingsTool: McpTool = {
  name: 'list_upcoming_meetings',
  description: 'List upcoming meetings from the user\'s Google Calendar. Shows meetings for a specified date range.',
  parameters: {
    days_ahead: {
      type: 'number',
      description: 'Number of days ahead to fetch meetings (default: 7)',
      required: false,
    },
    max_results: {
      type: 'number',
      description: 'Maximum number of meetings to return (default: 20)',
      required: false,
    },
  },
  async execute(userId: string, params: Record<string, any>) {
    const daysAhead = params.days_ahead || 7;
    const maxResults = params.max_results || 20;
    
    const connector = await ConnectorManager.getConnector(userId, 'GOOGLE_CALENDAR');
    const calendarConnector = connector as any;
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);
    
    const events = await calendarConnector.listEvents(startDate, endDate, maxResults);
    
    return {
      success: true,
      events: events.map((event: any) => ({
        id: event.id,
        title: event.title,
        start: event.startTime,
        end: event.endTime,
        location: event.location,
        attendees: event.attendees?.length || 0,
        meet_link: event.meetLink,
      })),
      count: events.length,
    };
  },
};

/**
 * Get details of a specific meeting
 */
export const getMeetingDetailsTool: McpTool = {
  name: 'get_meeting_details',
  description: 'Get detailed information about a specific calendar event by ID',
  parameters: {
    event_id: {
      type: 'string',
      description: 'The Google Calendar event ID',
      required: true,
    },
  },
  async execute(userId: string, params: Record<string, any>) {
    const eventId = params.event_id;
    
    if (!eventId) {
      throw new Error('event_id is required');
    }
    
    const connector = await ConnectorManager.getConnector(userId, 'GOOGLE_CALENDAR');
    const calendarConnector = connector as any;
    
    const event = await calendarConnector.getEvent(eventId);
    
    return {
      success: true,
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        start: event.startTime,
        end: event.endTime,
        location: event.location,
        attendees: event.attendees?.map((a: any) => ({
          email: a.email,
          name: a.name,
          status: a.responseStatus,
        })),
        meet_link: event.meetLink,
        recurring: event.recurring,
      },
    };
  },
};

/**
 * Create a new calendar event
 */
export const createMeetingTool: McpTool = {
  name: 'create_meeting',
  description: 'Create a new meeting on the user\'s Google Calendar',
  parameters: {
    title: {
      type: 'string',
      description: 'Meeting title',
      required: true,
    },
    start_time: {
      type: 'string',
      description: 'Meeting start time (ISO 8601 format)',
      required: true,
    },
    end_time: {
      type: 'string',
      description: 'Meeting end time (ISO 8601 format)',
      required: true,
    },
    description: {
      type: 'string',
      description: 'Meeting description',
      required: false,
    },
    location: {
      type: 'string',
      description: 'Meeting location',
      required: false,
    },
    attendees: {
      type: 'array',
      description: 'Array of attendee email addresses',
      required: false,
    },
  },
  async execute(userId: string, params: Record<string, any>) {
    const { title, start_time, end_time, description, location, attendees } = params;
    
    if (!title || !start_time || !end_time) {
      throw new Error('title, start_time, and end_time are required');
    }
    
    const connector = await ConnectorManager.getConnector(userId, 'GOOGLE_CALENDAR');
    const calendarConnector = connector as any;
    
    const event = await calendarConnector.createEvent({
      title,
      startTime: new Date(start_time),
      endTime: new Date(end_time),
      description,
      location,
      attendees,
    });
    
    return {
      success: true,
      event: {
        id: event.id,
        title: event.title,
        start: event.startTime,
        end: event.endTime,
        meet_link: event.meetLink,
      },
      message: 'Meeting created successfully',
    };
  },
};

// Export all calendar tools
export const calendarTools = [
  listUpcomingMeetingsTool,
  getMeetingDetailsTool,
  createMeetingTool,
];
