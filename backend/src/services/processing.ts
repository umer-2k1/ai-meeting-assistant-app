import prisma from '../lib/prisma.js';
import { serializeStringList } from '../lib/json-list.js';
import { parsePreferences } from '../lib/preferences.js';
import {
  generateMeetingSummary,
  extractActionItems,
  generateMeetingTitleAndTags,
  renderSummaryHtml,
} from './ai.js';
import {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
  embedTranscriptChunk,
  embedMeetingSummary,
} from './embeddings.js';
import {
  ensureCollections,
  storeMeetingEmbedding,
  storeTranscriptEmbedding,
} from './vector-store.js';

type MeetingWithTranscript = NonNullable<
  Awaited<ReturnType<typeof loadMeeting>>
>;

function loadMeeting(meetingId: string) {
  return prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      transcript: { orderBy: { timestampSeconds: 'asc' } },
      attendees: true,
      tags: true,
    },
  });
}

/**
 * Process meeting after recording ends.
 *
 * Critical path: generate the summary + action items and mark COMPLETED. This is
 * what the user sees and it depends only on the transcript + the summary LLM.
 *
 * Vector indexing (Gemini embeddings + Qdrant) is **best-effort**: it powers RAG
 * chat but a dead Qdrant cluster or a retired embedding model must NOT fail the
 * meeting. RAG already falls back to the full transcript when vectors are absent.
 */
export async function processMeeting(meetingId: string) {
  console.log(`[Processing] Starting post-meeting processing for ${meetingId}`);

  let meeting: MeetingWithTranscript;
  let summaryResult: Awaited<ReturnType<typeof generateMeetingSummary>>;

  try {
    // 1. Get meeting with transcript
    const loaded = await loadMeeting(meetingId);
    if (!loaded) {
      throw new Error('Meeting not found');
    }
    meeting = loaded;

    // 2. Combine transcript into text
    const transcriptText = meeting.transcript
      .map((line) => `[${line.timestamp}] ${line.speaker}: ${line.text}`)
      .join('\n\n');

    if (!transcriptText) {
      console.warn('[Processing] No transcript to process — completing empty meeting');
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'COMPLETED', processingError: null },
      });
      return { success: true, meetingId, summary: '', actionItemsCount: 0 };
    }

    // Load the owner's AI preferences (summary length / action sensitivity).
    const owner = await prisma.user.findUnique({
      where: { id: meeting.userId },
      select: { preferences: true },
    });
    const prefs = parsePreferences(owner?.preferences);

    // 3. Generate AI summary and extract decisions/risks
    console.log('[Processing] Generating AI summary...');
    summaryResult = await generateMeetingSummary(transcriptText, {
      length: prefs.summaryLength,
    });

    // 4. Extract action items
    console.log('[Processing] Extracting action items...');
    const actionItems = await extractActionItems(transcriptText, {
      sensitivity: prefs.actionSensitivity,
    });

    // 5. Update meeting with AI-generated content — mark COMPLETED here so the
    //    user sees the summary regardless of whether vector indexing succeeds.
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        aiSummary: summaryResult.summary,
        summaryHtml: renderSummaryHtml(summaryResult),
        keyDecisions: serializeStringList(summaryResult.decisions),
        risks: serializeStringList(summaryResult.risks),
        highlights: serializeStringList(summaryResult.keyPoints),
        status: 'COMPLETED',
        processingError: null,
      },
    });

    // 6. Create action items in database
    if (actionItems.length > 0) {
      console.log(`[Processing] Creating ${actionItems.length} action items...`);
      await prisma.actionItem.createMany({
        data: actionItems.map((item) => ({
          meetingId,
          task: item.task,
          assignee: item.assignee,
          priority: item.priority,
          status: 'PENDING',
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
        })),
      });
    }

    // 6b. AI title + topic tags (best-effort — never fail the meeting on these).
    try {
      const { title, tags } = await generateMeetingTitleAndTags({
        summary: summaryResult.summary,
        keyPoints: summaryResult.keyPoints,
        decisions: summaryResult.decisions,
      });
      // Only rename the auto-generated "Live session · …" titles; preserve any
      // title that came from a calendar event or the user.
      if (title && /^live session\b/i.test(meeting.title)) {
        await prisma.meeting
          .update({ where: { id: meetingId }, data: { title } })
          .catch(() => {});
      }
      if (tags.length > 0) {
        const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899'];
        await prisma.meetingTag
          .createMany({
            data: tags.map((name, i) => ({
              meetingId,
              name,
              color: palette[i % palette.length] ?? '#6366f1',
            })),
          })
          .catch(() => {});
      }
    } catch (error) {
      console.warn(
        '[Processing] Title/tags generation skipped:',
        error instanceof Error ? error.message : error
      );
    }

    console.log(`[Processing] Successfully completed processing for ${meetingId}`);

    // 7. Best-effort vector indexing — never fails the meeting.
    await indexMeetingVectors(meeting, summaryResult).catch((error) => {
      console.warn(
        '[Processing] Vector indexing skipped (best-effort):',
        error instanceof Error ? error.message : error
      );
    });

    return {
      success: true,
      meetingId,
      summary: summaryResult.summary,
      actionItemsCount: actionItems.length,
    };
  } catch (error) {
    console.error('[Processing] Error:', error);

    // Only summary/action-item/DB failures reach here — genuine failures worth
    // surfacing. Vector/embedding problems are handled above and never land here.
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'FAILED',
        processingError:
          error instanceof Error ? error.message : 'Unknown processing error',
      },
    }).catch(() => {});

    throw error;
  }
}

/**
 * Generate + store embeddings for the meeting and its transcript lines.
 * Best-effort: throwing here only skips RAG indexing; the meeting stays COMPLETED.
 * Individual transcript-line failures are swallowed so one bad line doesn't abort
 * the rest.
 */
async function indexMeetingVectors(
  meeting: MeetingWithTranscript,
  summaryResult: Awaited<ReturnType<typeof generateMeetingSummary>>
) {
  await ensureCollections();

  // Meeting-level embedding.
  console.log('[Processing] Generating meeting embedding...');
  const meetingEmbedding = await embedMeetingSummary({
    title: meeting.title,
    summary: summaryResult.summary,
    keyPoints: summaryResult.keyPoints,
    decisions: summaryResult.decisions,
  });

  const meetingPointId = await storeMeetingEmbedding(meeting.id, meetingEmbedding, {
    userId: meeting.userId,
    title: meeting.title,
    summary: summaryResult.summary,
    startTime: meeting.startTime,
    tags: meeting.tags.map((t) => t.name),
  });

  await prisma.meeting
    .update({ where: { id: meeting.id }, data: { embeddingId: meetingPointId } })
    .catch(() => {});

  await prisma.vectorEmbedding
    .create({
      data: {
        entityType: 'meeting',
        entityId: meeting.id,
        qdrantId: meetingPointId,
        collectionName: 'meetings',
        model: EMBEDDING_MODEL,
        dimension: EMBEDDING_DIMENSION,
      },
    })
    .catch(() => {});

  // Transcript-line embeddings, in chunks. A failure on one line is logged and
  // skipped rather than aborting the batch.
  console.log('[Processing] Generating transcript embeddings...');
  const BATCH_SIZE = 10;
  for (let i = 0; i < meeting.transcript.length; i += BATCH_SIZE) {
    const batch = meeting.transcript.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (line) => {
        try {
          const embedding = await embedTranscriptChunk({
            speaker: line.speaker,
            text: line.text,
            timestamp: line.timestamp,
          });

          const pointId = await storeTranscriptEmbedding(line.id, embedding, {
            meetingId: meeting.id,
            speaker: line.speaker,
            text: line.text,
            timestamp: line.timestamp,
          });

          await prisma.transcriptLine
            .update({ where: { id: line.id }, data: { embeddingId: pointId } })
            .catch(() => {});

          await prisma.vectorEmbedding.create({
            data: {
              entityType: 'transcript_line',
              entityId: line.id,
              qdrantId: pointId,
              collectionName: 'transcripts',
              model: EMBEDDING_MODEL,
              dimension: EMBEDDING_DIMENSION,
            },
          });
        } catch (error) {
          console.warn(
            `[Processing] Skipped embedding for transcript line ${line.id}:`,
            error instanceof Error ? error.message : error
          );
        }
      })
    );

    console.log(`[Processing] Processed ${i + batch.length}/${meeting.transcript.length} transcript lines`);
  }
}

/**
 * Reprocess an existing meeting (regenerate AI content)
 */
export async function reprocessMeeting(meetingId: string, userId: string) {
  // Verify ownership
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, userId },
  });

  if (!meeting) {
    throw new Error('Meeting not found or access denied');
  }

  // Set status back to PROCESSING
  await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: 'PROCESSING' },
  });

  // Run processing pipeline
  return processMeeting(meetingId);
}
