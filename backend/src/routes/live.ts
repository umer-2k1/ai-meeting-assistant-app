import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createTranscriptLineSchema, askQuestionSchema, validateOrThrow } from '../lib/schemas.js';
import {
  createMeeting,
  addTranscriptLine,
  getMeetingWithDetails,
  findOwnedMeeting,
} from '../services/meeting.js';
import { answerMeetingQuestionStream } from '../services/ai-stream.js';
import { searchTranscripts, generateEmbedding } from '../services/embeddings.js';
import { isVectorStoreAvailable } from '../services/vector-store.js';
import { embedTranscriptLineInBackground } from '../services/transcript-embedding.js';
import { getRouteParam } from '../lib/params.js';
import { createLogger, shortId } from '../lib/logger.js';

const log = createLogger('live');

const router = express.Router();

/**
 * POST /api/live/meetings
 * Start a new live meeting
 */
router.post('/meetings', requireAuth, async (req, res) => {
  try {
    const { title, description, platform, platformUrl, calendarEventId } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // A meeting is a CALENDAR meeting when it was started from a Google Calendar
    // event — the event id is the evidence, so derive the source from it rather
    // than trusting a separate client-supplied flag that could disagree.
    const source: 'DIRECT' | 'CALENDAR' =
      typeof calendarEventId === 'string' && calendarEventId.trim() ? 'CALENDAR' : 'DIRECT';

    const attendees = Array.isArray(req.body?.attendees)
      ? req.body.attendees
          .map((a: unknown) => {
            if (typeof a === 'string') return { name: a, email: null, role: null };
            const obj = a as { name?: unknown; email?: unknown; role?: unknown };
            return {
              name: typeof obj?.name === 'string' ? obj.name : '',
              email: typeof obj?.email === 'string' ? obj.email : null,
              role: typeof obj?.role === 'string' ? obj.role : null,
            };
          })
          .filter((a: { name: string; email: string | null }) => a.name || a.email)
      : [];

    const meeting = await createMeeting({
      userId: req.user!.id,
      title,
      description,
      startTime: new Date(),
      platform,
      platformUrl,
      source,
      calendarEventId: source === 'CALENDAR' ? calendarEventId.trim() : undefined,
      attendees,
    });

    log.info(
      `meeting ${shortId(meeting.id)} source=${source}` +
        (attendees.length ? ` with ${attendees.length} attendee(s)` : ' with no attendees')
    );

    // Update to LIVE status
    const { default: prisma } = await import('../lib/prisma.js');
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: 'LIVE',
        recordingStarted: new Date(),
      },
    });

    log.ok(`live meeting ${shortId(meeting.id)} started — "${meeting.title}"`);
    res.json({ meeting });
  } catch (error) {
    log.error('failed to start live meeting', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to start meeting' });
  }
});

/**
 * POST /api/live/meetings/:id/transcript
 * Add transcript line in real-time during live meeting
 */
router.post('/meetings/:id/transcript', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    if (!(await findOwnedMeeting(meetingId, req.user!.id))) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    const validated = validateOrThrow(createTranscriptLineSchema, {
      ...req.body,
      meetingId,
    });

    const transcriptLine = await addTranscriptLine(meetingId, validated);

    // Generate + store embedding in the background (don't block the response).
    embedTranscriptLineInBackground({
      id: transcriptLine.id,
      meetingId,
      speaker: transcriptLine.speaker,
      text: transcriptLine.text,
      timestamp: transcriptLine.timestamp,
    });

    res.json({ transcriptLine });
  } catch (error) {
    console.error('Add transcript error:', error);
    res.status(400).json({ error: 'Failed to add transcript line' });
  }
});

/**
 * GET /api/live/meetings/:id/chat
 *
 * This meeting's AI chat history, oldest first. Answers were already being
 * persisted per meeting but never read back, so the UI kept one in-memory list
 * shared by every meeting — opening meeting B showed meeting A's conversation.
 * Ownership is enforced through the meeting, so one user cannot read another's.
 */
router.get('/meetings/:id/chat', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    const { default: prisma } = await import('../lib/prisma.js');

    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, userId: req.user!.id },
      select: { id: true },
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const messages = await prisma.aIChatMessage.findMany({
      where: { meetingId, userId: req.user!.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, question: true, answer: true, createdAt: true },
    });

    res.json({
      messages: messages.map((m) => ({
        id: m.id,
        question: m.question,
        answer: m.answer,
        timestamp: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Failed to load meeting chat history:', error);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

/**
 * POST /api/live/meetings/:id/ask
 * Ask AI question with Server-Sent Events streaming
 */
router.post('/meetings/:id/ask', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    const validated = validateOrThrow(askQuestionSchema, req.body);

    // Check if streaming is requested
    if (validated.stream) {
      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Get meeting with current transcript
      const meeting = await getMeetingWithDetails(meetingId, req.user!.id);

      if (!meeting) {
        res.write(`data: ${JSON.stringify({ error: 'Meeting not found' })}\n\n`);
        res.end();
        return;
      }

      type TranscriptPayload = {
        timestamp?: string;
        speaker?: string;
        text?: string;
      };

      // Get relevant context via vector search (best-effort — if the embedding
      // call fails, e.g. Gemini is down, we fall back to the full transcript
      // below). Vectors live in local SQLite, so the store itself is always
      // available; isVectorStoreAvailable() is kept as a stable seam.
      let transcriptContext = '';
      if (isVectorStoreAvailable()) {
        try {
          const queryEmbedding = await generateEmbedding(validated.question);
          const relevantSnippets = await searchTranscripts(queryEmbedding, meetingId, 5);
          transcriptContext = relevantSnippets
            .map((result) => {
              const payload = result.payload as TranscriptPayload;
              return `[${payload.timestamp ?? ''}] ${payload.speaker ?? ''}: ${payload.text ?? ''}`;
            })
            .join('\n');
        } catch {
          // vector-store already logged a single concise warning; fall through.
        }
      }

      const fullTranscript = meeting.transcript
        .map((line) => `[${line.timestamp}] ${line.speaker}: ${line.text}`)
        .join('\n');

      const actionItemsText = meeting.actionItems
        .map((item) => `- ${item.task} (${item.assignee || 'Unassigned'})`)
        .join('\n');

      // Stream the response
      await answerMeetingQuestionStream(
        validated.question,
        {
          transcript: transcriptContext || fullTranscript,
          summary: meeting.aiSummary || undefined,
          actionItems: actionItemsText,
        },
        {
          onToken: (token) => {
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          },
          onComplete: async (fullAnswer, metadata) => {
            // Save to database — a persistence failure must not swallow the
            // `done` frame, or the client hangs on a completed answer.
            try {
              const { default: prisma } = await import('../lib/prisma.js');
              await prisma.aIChatMessage.create({
                data: {
                  meetingId: meeting.id,
                  userId: req.user!.id,
                  question: validated.question,
                  answer: fullAnswer,
                  contextType: 'transcript',
                  contextSnippet: transcriptContext.substring(0, 500),
                  model: 'groq',
                  tokensUsed: metadata?.tokensUsed,
                  responseTime: metadata?.responseTime,
                },
              });
            } catch (dbError) {
              console.error('Failed to persist chat message:', dbError);
            }

            if (!res.writableEnded) {
              res.write(`data: ${JSON.stringify({ done: true, timestamp: metadata?.timestamp })}\n\n`);
              res.end();
            }
          },
          onError: (error) => {
            if (!res.writableEnded) {
              res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
              res.end();
            }
          },
        }
      );
    } else {
      // Non-streaming response (legacy)
      const meeting = await getMeetingWithDetails(meetingId, req.user!.id);
      
      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }

      const transcriptText = meeting.transcript
        .map((line) => `[${line.timestamp}] ${line.speaker}: ${line.text}`)
        .join('\n');

      const actionItemsText = meeting.actionItems
        .map((item) => `- ${item.task} (${item.assignee || 'Unassigned'})`)
        .join('\n');

      const { answerMeetingQuestion } = await import('../services/ai.js');
      const answer = await answerMeetingQuestion(validated.question, {
        transcript: transcriptText,
        summary: meeting.aiSummary || undefined,
        actionItems: actionItemsText,
      });

      const { default: prisma } = await import('../lib/prisma.js');
      await prisma.aIChatMessage.create({
        data: {
          meetingId: meeting.id,
          userId: req.user!.id,
          question: validated.question,
          answer: answer.answer,
          contextType: 'transcript',
          model: 'groq',
        },
      });

      res.json(answer);
    }
  } catch (error) {
    console.error('Ask AI error:', error);
    // If SSE headers are already out, a JSON status response would corrupt the
    // stream — emit a final SSE error frame instead.
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: 'Failed to answer question' })}\n\n`);
        res.end();
      }
      return;
    }
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

export default router;
