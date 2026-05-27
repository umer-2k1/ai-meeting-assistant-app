import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createTranscriptLineSchema, askQuestionSchema, validateOrThrow } from '../lib/schemas.js';
import {
  createMeeting,
  addTranscriptLine,
  getMeetingWithDetails,
} from '../services/meeting.js';
import { answerMeetingQuestionStream } from '../services/ai-stream.js';
import { searchTranscripts, generateEmbedding } from '../services/embeddings.js';

const router = express.Router();

/**
 * POST /api/live/meetings
 * Start a new live meeting
 */
router.post('/meetings', requireAuth, async (req, res) => {
  try {
    const { title, description, platform, platformUrl } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const meeting = await createMeeting({
      userId: req.user!.id,
      title,
      description,
      startTime: new Date(),
      platform,
      platformUrl,
    });

    // Update to LIVE status
    const { default: prisma } = await import('../lib/prisma.js');
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: 'LIVE',
        recordingStarted: new Date(),
      },
    });

    res.json({ meeting });
  } catch (error) {
    console.error('Start live meeting error:', error);
    res.status(500).json({ error: 'Failed to start meeting' });
  }
});

/**
 * POST /api/live/meetings/:id/transcript
 * Add transcript line in real-time during live meeting
 */
router.post('/meetings/:id/transcript', requireAuth, async (req, res) => {
  try {
    const validated = validateOrThrow(createTranscriptLineSchema, {
      ...req.body,
      meetingId: req.params.id,
    });

    const transcriptLine = await addTranscriptLine(req.params.id, validated);

    // Generate embedding in background (don't block response)
    const { embedTranscriptChunk, storeTranscriptEmbedding } = await import('../services/embeddings.js');
    const { default: prisma } = await import('../lib/prisma.js');
    
    embedTranscriptChunk({
      speaker: transcriptLine.speaker,
      text: transcriptLine.text,
      timestamp: transcriptLine.timestamp,
    })
      .then((embedding) => {
        return storeTranscriptEmbedding(transcriptLine.id, embedding, {
          meetingId: req.params.id,
          speaker: transcriptLine.speaker,
          text: transcriptLine.text,
          timestamp: transcriptLine.timestamp,
        });
      })
      .then(() => {
        return prisma.vectorEmbedding.create({
          data: {
            entityType: 'transcript_line',
            entityId: transcriptLine.id,
            qdrantId: transcriptLine.id,
            collectionName: 'transcripts',
            model: 'gemini',
            dimension: 768,
          },
        });
      })
      .catch((error) => {
        console.error('Background embedding error:', error);
      });

    res.json({ transcriptLine });
  } catch (error) {
    console.error('Add transcript error:', error);
    res.status(400).json({ error: 'Failed to add transcript line' });
  }
});

/**
 * POST /api/live/meetings/:id/ask
 * Ask AI question with Server-Sent Events streaming
 */
router.post('/meetings/:id/ask', requireAuth, async (req, res) => {
  try {
    const validated = validateOrThrow(askQuestionSchema, req.body);

    // Check if streaming is requested
    if (validated.stream) {
      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Get meeting with current transcript
      const meeting = await getMeetingWithDetails(req.params.id, req.user!.id);

      if (!meeting) {
        res.write(`data: ${JSON.stringify({ error: 'Meeting not found' })}\n\n`);
        res.end();
        return;
      }

      // Get relevant context using vector search
      const queryEmbedding = await generateEmbedding(validated.question);
      const relevantSnippets = await searchTranscripts(queryEmbedding, req.params.id, 5);

      const transcriptContext = relevantSnippets
        .map((result) => {
          const payload = result.payload as any;
          return `[${payload.timestamp}] ${payload.speaker}: ${payload.text}`;
        })
        .join('\n');

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
            // Save to database
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

            res.write(`data: ${JSON.stringify({ done: true, timestamp: metadata?.timestamp })}\n\n`);
            res.end();
          },
          onError: (error) => {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
          },
        }
      );
    } else {
      // Non-streaming response (legacy)
      const meeting = await getMeetingWithDetails(req.params.id, req.user!.id);
      
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
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

export default router;
