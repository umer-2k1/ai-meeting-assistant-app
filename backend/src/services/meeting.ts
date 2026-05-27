import prisma from '../lib/prisma.js';
import { uploadAndCleanup } from './cloudinary.js';
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
