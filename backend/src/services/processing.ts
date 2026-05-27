import prisma from '../lib/prisma.js';
import {
  generateMeetingSummary,
  extractActionItems,
} from './ai.js';
import {
  generateEmbedding,
  embedTranscriptChunk,
  embedMeetingSummary,
} from './embeddings.js';
import {
  ensureCollections,
  storeMeetingEmbedding,
  storeTranscriptEmbedding,
} from './vector-store.js';

/**
 * Process meeting after recording ends
 * This is the main post-meeting intelligence pipeline
 */
export async function processMeeting(meetingId: string) {
  console.log(`[Processing] Starting post-meeting processing for ${meetingId}`);

  try {
    // Ensure Qdrant collections exist
    await ensureCollections();

    // 1. Get meeting with transcript
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        transcript: {
          orderBy: { timestampSeconds: 'asc' },
        },
        attendees: true,
        tags: true,
      },
    });

    if (!meeting) {
      throw new Error('Meeting not found');
    }

    // 2. Combine transcript into text
    const transcriptText = meeting.transcript
      .map((line) => `[${line.timestamp}] ${line.speaker}: ${line.text}`)
      .join('\n\n');

    if (!transcriptText) {
      console.warn('[Processing] No transcript to process');
      return;
    }

    // 3. Generate AI summary and extract decisions/risks
    console.log('[Processing] Generating AI summary...');
    const summaryResult = await generateMeetingSummary(transcriptText);

    // 4. Extract action items
    console.log('[Processing] Extracting action items...');
    const actionItems = await extractActionItems(transcriptText);

    // 5. Update meeting with AI-generated content
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        aiSummary: summaryResult.summary,
        keyDecisions: summaryResult.decisions,
        risks: summaryResult.risks,
        highlights: summaryResult.keyPoints,
        status: 'COMPLETED',
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

    // 7. Generate and store meeting embedding
    console.log('[Processing] Generating meeting embedding...');
    const meetingEmbedding = await embedMeetingSummary({
      title: meeting.title,
      summary: summaryResult.summary,
      keyPoints: summaryResult.keyPoints,
      decisions: summaryResult.decisions,
    });

    await storeMeetingEmbedding(meetingId, meetingEmbedding, {
      userId: meeting.userId,
      title: meeting.title,
      summary: summaryResult.summary,
      startTime: meeting.startTime,
      tags: meeting.tags.map((t) => t.name),
    });

    // 8. Generate and store transcript embeddings (batch process in chunks)
    console.log('[Processing] Generating transcript embeddings...');
    const BATCH_SIZE = 10;
    for (let i = 0; i < meeting.transcript.length; i += BATCH_SIZE) {
      const batch = meeting.transcript.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (line) => {
          const embedding = await embedTranscriptChunk({
            speaker: line.speaker,
            text: line.text,
            timestamp: line.timestamp,
          });

          await storeTranscriptEmbedding(line.id, embedding, {
            meetingId,
            speaker: line.speaker,
            text: line.text,
            timestamp: line.timestamp,
          });

          // Store embedding reference in database
          await prisma.vectorEmbedding.create({
            data: {
              entityType: 'transcript_line',
              entityId: line.id,
              qdrantId: line.id,
              collectionName: 'transcripts',
              model: 'gemini',
              dimension: 768,
            },
          });
        })
      );

      console.log(`[Processing] Processed ${i + batch.length}/${meeting.transcript.length} transcript lines`);
    }

    // 9. Store meeting embedding reference
    await prisma.vectorEmbedding.create({
      data: {
        entityType: 'meeting',
        entityId: meetingId,
        qdrantId: meetingId,
        collectionName: 'meetings',
        model: 'gemini',
        dimension: 768,
      },
    });

    console.log(`[Processing] Successfully completed processing for ${meetingId}`);

    return {
      success: true,
      meetingId,
      summary: summaryResult.summary,
      actionItemsCount: actionItems.length,
    };
  } catch (error) {
    console.error('[Processing] Error:', error);

    // Mark meeting as completed with error
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'COMPLETED',
      },
    }).catch(() => {});

    throw error;
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
