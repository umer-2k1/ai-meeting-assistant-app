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
  embedTranscriptChunk,
  embedMeetingSummary,
} from './embeddings.js';
import {
  ensureCollections,
  storeMeetingEmbedding,
  storeTranscriptEmbedding,
} from './vector-store.js';
import { autoEmailMeetingSummary, autoSlackMeetingSummary } from './share.js';
import { createLogger, shortId } from '../lib/logger.js';

const log = createLogger('processing');

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
 * Vector indexing (Gemini embeddings, stored in SQLite) is **best-effort**: it
 * powers RAG chat but a Gemini outage or a retired embedding model must NOT fail
 * the meeting. RAG already falls back to the full transcript when vectors are absent.
 */
export async function processMeeting(meetingId: string) {
  const mid = shortId(meetingId);
  log.step(`starting post-meeting processing for ${mid}`);
  const startedAt = Date.now();

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
      log.warn(`no transcript to process — completing empty meeting (${mid})`);
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
    log.step(`generating AI summary (${meeting.transcript.length} transcript lines, ${mid})`);
    summaryResult = await generateMeetingSummary(transcriptText, {
      length: prefs.summaryLength,
    });

    // 4. Extract action items
    log.step(`extracting action items (${mid})`);
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
      log.step(`saving ${actionItems.length} action item(s) (${mid})`);
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
      log.warn(`title/tags generation skipped (${mid})`, error instanceof Error ? error.message : error);
    }

    log.ok(`processing complete for ${mid} in ${Date.now() - startedAt}ms → COMPLETED`);

    // 7. Best-effort vector indexing — never fails the meeting, but a persisted
    //    warning lets the UI say "semantic search unavailable for this meeting"
    //    instead of degrading silently.
    await indexMeetingVectors(meeting, summaryResult).catch(async (error) => {
      log.warn(`vector indexing skipped (best-effort, ${mid})`, error instanceof Error ? error.message : error);
      await prisma.meeting
        .update({
          where: { id: meetingId },
          data: {
            processingError:
              'Semantic search indexing failed — Ask AI uses the full transcript for this meeting.',
          },
        })
        .catch(() => {});
    });

    // 8. Auto-email the summary (owner + attendees) when Gmail is connected.
    //    Best-effort: a mail failure must never fail the meeting. Idempotent, so
    //    reprocessing an already-emailed meeting won't send a duplicate.
    log.step(`auto-emailing summary if Gmail connected (${mid})`);
    await autoEmailMeetingSummary(meetingId).catch((error) => {
      log.warn(`auto-email skipped (best-effort, ${mid})`, error instanceof Error ? error.message : error);
    });

    // 9. Auto-post to Slack when the user picked a default channel and enabled
    //    it. Same best-effort/idempotent contract as the email above.
    log.step(`auto-posting to Slack if enabled (${mid})`);
    await autoSlackMeetingSummary(meetingId).catch((error) => {
      log.warn(
        `auto-slack skipped (best-effort, ${mid})`,
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
    log.error(`processing failed for ${mid} → FAILED`, error instanceof Error ? error.message : error);

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
  log.info('generating meeting embedding (vector index)');
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

  // storeMeetingEmbedding already persisted the VectorEmbedding row; just point
  // the meeting at it.
  await prisma.meeting
    .update({ where: { id: meeting.id }, data: { embeddingId: meetingPointId } })
    .catch(() => {});

  // Transcript-line embeddings, in chunks. A failure on one line is logged and
  // skipped rather than aborting the batch.
  log.info('generating transcript embeddings (vector index)');
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

          // storeTranscriptEmbedding already persisted the VectorEmbedding row.
          await prisma.transcriptLine
            .update({ where: { id: line.id }, data: { embeddingId: pointId } })
            .catch(() => {});
        } catch (error) {
          log.warn(
            `skipped embedding for transcript line ${shortId(line.id)}`,
            error instanceof Error ? error.message : error
          );
        }
      })
    );

    log.info(`embedded ${i + batch.length}/${meeting.transcript.length} transcript lines`);
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
