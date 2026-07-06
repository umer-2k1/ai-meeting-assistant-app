import prisma from '../lib/prisma.js';
import { uploadAudioBuffer } from './cloudinary.js';
import { parseStringList } from '../lib/json-list.js';
import type { Meeting, TranscriptLine } from '@prisma/client';

/**
 * Return the meeting id when it exists and belongs to the user, else null.
 * Routes use this as the ownership gate before mutating meeting sub-resources.
 */
export async function findOwnedMeeting(meetingId: string, userId: string) {
  return prisma.meeting.findFirst({
    where: { id: meetingId, userId },
    select: { id: true },
  });
}

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
 * Resolve LIVE meetings orphaned by an abandoned session or a crash.
 *
 * A meeting is created as LIVE the moment "New Recording" is clicked and only
 * leaves LIVE when the user stops it. If the app is closed (or the stop never
 * fires) the row stays LIVE forever, cluttering the dashboard with ghost
 * sessions. After a server restart nothing can still be recording, so every
 * remaining LIVE row is stale:
 *   - empty ones (no transcript) are deleted as junk (relations cascade),
 *   - ones with transcript are pushed to PROCESSING and returned so the caller
 *     can finish them (generate a summary) instead of losing the content.
 *
 * Returns the ids of non-empty meetings that still need processing.
 */
export async function sweepOrphanedLiveMeetings(): Promise<string[]> {
  const liveMeetings = await prisma.meeting.findMany({
    where: { status: 'LIVE' },
    select: { id: true, recordingStarted: true, _count: { select: { transcript: true } } },
  });

  const toProcess: string[] = [];

  for (const meeting of liveMeetings) {
    if (meeting._count.transcript === 0) {
      await prisma.meeting.delete({ where: { id: meeting.id } }).catch(() => {});
      continue;
    }

    await prisma.meeting
      .update({
        where: { id: meeting.id },
        data: { status: 'PROCESSING', recordingEnded: new Date() },
      })
      .catch(() => {});
    toProcess.push(meeting.id);
  }

  if (liveMeetings.length > 0) {
    console.log(
      `[startup] Swept ${liveMeetings.length} orphaned LIVE meeting(s): ` +
        `${liveMeetings.length - toProcess.length} empty deleted, ${toProcess.length} queued for processing`
    );
  }

  return toProcess;
}

/**
 * Finalize a single LIVE meeting whose WebSocket closed without an explicit
 * `/complete` (app closed, crashed, or navigated away mid-recording).
 *
 * Race-safe against the normal stop flow (which calls `/complete`): the caller
 * should invoke this on a short delay so `/complete` wins the common case, and
 * the LIVE→PROCESSING transition here is atomic (`updateMany` guarded on
 * `status: 'LIVE'`) so processing is triggered at most once.
 *
 * - Not LIVE anymore → no-op (someone else finalized it).
 * - LIVE + empty transcript → deleted (abandoned ghost session).
 * - LIVE + has transcript → PROCESSING; returns `{ process: true }` so the
 *   caller runs `processMeeting`.
 */
export async function finalizeAbandonedMeeting(
  meetingId: string
): Promise<{ process: boolean }> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      status: true,
      recordingStarted: true,
      _count: { select: { transcript: true } },
    },
  });

  if (!meeting || meeting.status !== 'LIVE') return { process: false };

  if (meeting._count.transcript === 0) {
    // Guard on status so we never delete a meeting the /complete path claimed.
    await prisma.meeting.deleteMany({ where: { id: meetingId, status: 'LIVE' } });
    return { process: false };
  }

  const recordingEnded = new Date();
  const duration = meeting.recordingStarted
    ? Math.floor((recordingEnded.getTime() - meeting.recordingStarted.getTime()) / 1000)
    : null;

  const claimed = await prisma.meeting.updateMany({
    where: { id: meetingId, status: 'LIVE' },
    data: { status: 'PROCESSING', endTime: recordingEnded, recordingEnded, duration },
  });

  return { process: claimed.count === 1 };
}

/**
 * Attach `speakerCount` (distinct diarized transcript speakers) to meeting rows.
 * Live/manual recordings never populate MeetingAttendee, so the participant
 * count falls back to how many distinct speakers Deepgram detected.
 */
export async function attachSpeakerCounts<T extends { id: string }>(
  meetings: T[]
): Promise<(T & { speakerCount: number })[]> {
  if (meetings.length === 0) return [];
  const groups = await prisma.transcriptLine.groupBy({
    by: ['meetingId', 'speaker'],
    where: { meetingId: { in: meetings.map((m) => m.id) } },
  });
  const counts = new Map<string, number>();
  for (const g of groups) counts.set(g.meetingId, (counts.get(g.meetingId) ?? 0) + 1);
  return meetings.map((m) => ({ ...m, speakerCount: counts.get(m.id) ?? 0 }));
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
 * Store a recorded/imported audio blob (from multer memoryStorage) on a meeting.
 * Uploads to Cloudinary and sets audioUrl/audioDuration so the detail player
 * plays real audio instead of the demo fallback.
 */
export async function updateMeetingAudioBuffer(meetingId: string, buffer: Buffer) {
  const uploadResult = await uploadAudioBuffer(buffer, {
    publicId: `meeting-${meetingId}`,
    folder: 'meeting-recordings',
  });

  return prisma.meeting.update({
    where: { id: meetingId },
    data: {
      audioUrl: uploadResult.secureUrl,
      audioDuration: uploadResult.duration,
    },
  });
}

/**
 * Complete a meeting (mark as PROCESSING).
 *
 * Race-safe against `finalizeAbandonedMeeting` (fired on WebSocket close): the
 * LIVE→PROCESSING transition is atomic (`updateMany` guarded on
 * `status: 'LIVE'`), so exactly one caller "claims" the meeting and triggers
 * processing. `claimed: false` means someone else already finalized it.
 */
export async function completeMeeting(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, userId },
  });

  if (!meeting) {
    throw new Error('Meeting not found');
  }

  const recordingEnded = meeting.recordingEnded || new Date();
  const duration = meeting.recordingStarted
    ? Math.floor((recordingEnded.getTime() - meeting.recordingStarted.getTime()) / 1000)
    : null;

  const result = await prisma.meeting.updateMany({
    where: { id: meetingId, status: 'LIVE' },
    data: {
      status: 'PROCESSING',
      endTime: recordingEnded,
      recordingEnded,
      duration,
    },
  });

  const updated = await prisma.meeting.findUnique({ where: { id: meetingId } });
  return { meeting: updated!, claimed: result.count === 1 };
}

/**
 * Get meeting with all related data
 */
export async function getMeetingWithDetails(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findFirst({
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

  if (!meeting) return null;
  // Distinct diarized speakers → participant fallback when no attendees exist.
  const speakerCount = new Set(meeting.transcript.map((l) => l.speaker)).size;
  return { ...meeting, speakerCount };
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

  const meetings = await prisma.meeting.findMany({
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
  return attachSpeakerCounts(meetings);
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

/**
 * Delete a meeting (and, via cascade, its transcript/action items/notes/etc.).
 * Verifies ownership. Also best-effort removes its vectors from Qdrant.
 */
export async function deleteMeeting(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, userId },
  });
  if (!meeting) {
    throw new Error('Meeting not found or access denied');
  }

  // Best-effort: remove vectors before deleting the row.
  try {
    const { deleteMeetingEmbeddings } = await import('./vector-store.js');
    await deleteMeetingEmbeddings(meetingId);
  } catch (error) {
    console.warn('[deleteMeeting] failed to remove vectors (continuing):', error);
  }

  await prisma.vectorEmbedding.deleteMany({ where: { entityId: meetingId } });
  return prisma.meeting.delete({ where: { id: meetingId } });
}

/**
 * Search a user's meetings. Uses semantic (Qdrant) search when available and
 * merges with a SQL title/summary match so results are returned even before any
 * embeddings exist. Returns full meeting rows (with attendees/tags/counts).
 */
export async function searchMeetings(userId: string, query: string, limit = 20) {
  const q = query.trim();
  if (!q) {
    return getUserMeetings(userId, { limit });
  }

  const orderedIds: string[] = [];
  const seen = new Set<string>();
  const push = (id?: string | null) => {
    if (id && !seen.has(id)) {
      seen.add(id);
      orderedIds.push(id);
    }
  };

  // 1. Semantic search (best-effort; skipped if Qdrant/Gemini unavailable).
  try {
    const { generateEmbedding } = await import('./embeddings.js');
    const { searchSimilarMeetings } = await import('./vector-store.js');
    const embedding = await generateEmbedding(q);
    const results = await searchSimilarMeetings(embedding, userId, limit);
    for (const r of results) {
      const payload = r.payload as { meetingId?: string } | undefined;
      push(payload?.meetingId);
    }
  } catch (error) {
    console.warn('[searchMeetings] semantic search unavailable, using SQL only:', error);
  }

  // 2. SQL keyword fallback/augmentation on title + summary.
  const sqlMatches = await prisma.meeting.findMany({
    where: {
      userId,
      OR: [{ title: { contains: q } }, { aiSummary: { contains: q } }],
    },
    orderBy: { startTime: 'desc' },
    take: limit,
  });
  for (const m of sqlMatches) push(m.id);

  if (orderedIds.length === 0) return [];

  // 3. Hydrate the ordered ids with full relations, preserving rank order.
  const meetings = await prisma.meeting.findMany({
    where: { id: { in: orderedIds }, userId },
    include: {
      attendees: true,
      tags: true,
      _count: { select: { transcript: true, actionItems: true } },
    },
  });
  const byId = new Map(meetings.map((m) => [m.id, m]));
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  return attachSpeakerCounts(ordered);
}

// ========================================
// Meeting Notes
// ========================================

export async function listNotes(meetingId: string, userId: string) {
  return prisma.meetingNote.findMany({
    where: { meetingId, userId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createNote(
  meetingId: string,
  userId: string,
  data: { content: string; contentHtml?: string | null }
) {
  // Ensure the meeting belongs to the user before attaching a note.
  const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, userId } });
  if (!meeting) throw new Error('Meeting not found or access denied');

  return prisma.meetingNote.create({
    data: {
      meetingId,
      userId,
      content: data.content,
      contentHtml: data.contentHtml ?? null,
    },
  });
}

export async function updateNote(
  noteId: string,
  userId: string,
  data: { content: string; contentHtml?: string | null }
) {
  const note = await prisma.meetingNote.findFirst({ where: { id: noteId, userId } });
  if (!note) throw new Error('Note not found or access denied');

  return prisma.meetingNote.update({
    where: { id: noteId },
    data: { content: data.content, contentHtml: data.contentHtml ?? null },
  });
}

export async function deleteNote(noteId: string, userId: string) {
  const note = await prisma.meetingNote.findFirst({ where: { id: noteId, userId } });
  if (!note) throw new Error('Note not found or access denied');

  return prisma.meetingNote.delete({ where: { id: noteId } });
}
