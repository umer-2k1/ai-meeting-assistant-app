import prisma from '../lib/prisma.js';
import { uploadAndCleanup } from './cloudinary.js';
import { parseStringList } from '../lib/json-list.js';
import type { Meeting, TranscriptLine } from '@prisma/client';

/**
 * Create a new meeting record
 */
export async function createMeeting(data: {
  userId: string;
  title: string;
  description?: string;
  startTime: Date;
  platform?: string;
  platformUrl?: string;
}) {
  return prisma.meeting.create({
    data: {
      ...data,
      status: 'LIVE',
    },
  });
}

/**
 * Add transcript line to meeting
 */
export async function addTranscriptLine(
  meetingId: string,
  data: {
    speaker: string;
    text: string;
    timestamp: string;
    timestampSeconds: number;
    confidence?: number;
    highlighted?: boolean;
  }
) {
  return prisma.transcriptLine.create({
    data: {
      meetingId,
      ...data,
    },
  });
}

/**
 * Update meeting with recording audio URL
 */
export async function updateMeetingAudio(
  meetingId: string,
  audioPath: string
) {
  try {
    // Upload to Cloudinary
    const uploadResult = await uploadAndCleanup(audioPath, {
      publicId: `meeting-${meetingId}`,
      folder: 'meeting-recordings',
    });

    // Update meeting record
    return prisma.meeting.update({
      where: { id: meetingId },
      data: {
        audioUrl: uploadResult.secureUrl,
        audioDuration: uploadResult.duration,
        recordingEnded: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to update meeting audio:', error);
    throw error;
  }
}

/**
 * Complete a meeting (mark as PROCESSING)
 */
export async function completeMeeting(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      transcript: true,
    },
  });

  if (!meeting) {
    throw new Error('Meeting not found');
  }

  // Calculate duration
  const duration = meeting.recordingEnded && meeting.recordingStarted
    ? Math.floor((meeting.recordingEnded.getTime() - meeting.recordingStarted.getTime()) / 1000)
    : null;

  return prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: 'PROCESSING',
      endTime: meeting.recordingEnded || new Date(),
      duration,
    },
  });
}

/**
 * Get meeting with all related data
 */
export async function getMeetingWithDetails(meetingId: string, userId: string) {
  return prisma.meeting.findFirst({
    where: {
      id: meetingId,
      userId,
    },
    include: {
      attendees: true,
      transcript: {
        orderBy: { timestampSeconds: 'asc' },
      },
      actionItems: {
        orderBy: { createdAt: 'desc' },
      },
      tags: true,
      notes: true,
      chatMessages: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

/**
 * Get user's meetings
 */
export async function getUserMeetings(
  userId: string,
  options: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const where: any = { userId };
  
  if (options.status) {
    where.status = options.status;
  }

  return prisma.meeting.findMany({
    where,
    include: {
      attendees: true,
      tags: true,
      _count: {
        select: {
          transcript: true,
          actionItems: true,
        },
      },
    },
    orderBy: { startTime: 'desc' },
    take: options.limit || 50,
    skip: options.offset || 0,
  });
}

/**
 * Map a Prisma meeting row to the API shape.
 *
 * SQLite stores `keyDecisions`, `risks`, `highlights` as JSON strings; parse
 * them back into arrays so API consumers always receive `string[]`. Pass any
 * meeting-like object (with or without relations/_count) — extra fields are
 * preserved untouched. Returns `null` for a `null` input for convenience.
 */
export function serializeMeetingForApi<
  T extends {
    keyDecisions?: string | string[] | null;
    risks?: string | string[] | null;
    highlights?: string | string[] | null;
  }
>(meeting: T | null): (Omit<T, 'keyDecisions' | 'risks' | 'highlights'> & {
  keyDecisions: string[];
  risks: string[];
  highlights: string[];
}) | null {
  if (!meeting) return null;
  const asList = (v: string | string[] | null | undefined): string[] =>
    Array.isArray(v) ? v : parseStringList(v);
  return {
    ...meeting,
    keyDecisions: asList(meeting.keyDecisions),
    risks: asList(meeting.risks),
    highlights: asList(meeting.highlights),
  };
}
