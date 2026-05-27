import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createMeeting,
  addTranscriptLine,
  updateMeetingAudio,
  completeMeeting,
  getMeetingWithDetails,
  getUserMeetings,
} from '../services/meeting.js';
import { processMeeting, reprocessMeeting } from '../services/processing.js';
import { answerMeetingQuestion } from '../services/ai.js';

const router = express.Router();

/**
 * GET /api/meetings
 * Get user's meetings
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, limit, offset } = req.query;

    const meetings = await getUserMeetings(req.user!.id, {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({ meetings });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

/**
 * GET /api/meetings/:id
 * Get meeting details
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const meeting = await getMeetingWithDetails(req.params.id, req.user!.id);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ meeting });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
});

/**
 * POST /api/meetings
 * Create a new meeting
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, startTime, platform, platformUrl } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const meeting = await createMeeting({
      userId: req.user!.id,
      title,
      description,
      startTime: startTime ? new Date(startTime) : new Date(),
      platform,
      platformUrl,
    });

    res.json({ meeting });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

/**
 * POST /api/meetings/:id/transcript
 * Add transcript line to meeting
 */
router.post('/:id/transcript', requireAuth, async (req, res) => {
  try {
    const { speaker, text, timestamp, timestampSeconds, confidence, highlighted } = req.body;

    if (!speaker || !text || !timestamp || timestampSeconds === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const transcriptLine = await addTranscriptLine(req.params.id, {
      speaker,
      text,
      timestamp,
      timestampSeconds,
      confidence,
      highlighted,
    });

    res.json({ transcriptLine });
  } catch (error) {
    console.error('Add transcript error:', error);
    res.status(500).json({ error: 'Failed to add transcript line' });
  }
});

/**
 * POST /api/meetings/:id/complete
 * Complete meeting and trigger processing
 */
router.post('/:id/complete', requireAuth, async (req, res) => {
  try {
    const { audioPath } = req.body;

    // Update meeting status
    const meeting = await completeMeeting(req.params.id);

    // Upload audio if provided
    if (audioPath) {
      await updateMeetingAudio(req.params.id, audioPath);
    }

    // Trigger async processing
    processMeeting(req.params.id).catch((error) => {
      console.error('Background processing error:', error);
    });

    res.json({ meeting, processing: true });
  } catch (error) {
    console.error('Complete meeting error:', error);
    res.status(500).json({ error: 'Failed to complete meeting' });
  }
});

/**
 * POST /api/meetings/:id/reprocess
 * Reprocess meeting AI content
 */
router.post('/:id/reprocess', requireAuth, async (req, res) => {
  try {
    const result = await reprocessMeeting(req.params.id, req.user!.id);
    res.json(result);
  } catch (error) {
    console.error('Reprocess meeting error:', error);
    res.status(500).json({ error: 'Failed to reprocess meeting' });
  }
});

/**
 * POST /api/meetings/:id/ask
 * Ask AI question about meeting
 */
router.post('/:id/ask', requireAuth, async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const meeting = await getMeetingWithDetails(req.params.id, req.user!.id);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Prepare context
    const transcriptText = meeting.transcript
      .map((line) => `[${line.timestamp}] ${line.speaker}: ${line.text}`)
      .join('\n');

    const actionItemsText = meeting.actionItems
      .map((item) => `- ${item.task} (${item.assignee || 'Unassigned'})`)
      .join('\n');

    const answer = await answerMeetingQuestion(question, {
      transcript: transcriptText,
      summary: meeting.aiSummary || undefined,
      actionItems: actionItemsText,
    });

    // Save to chat history
    const { default: prisma } = await import('../lib/prisma.js');
    await prisma.aIChatMessage.create({
      data: {
        meetingId: meeting.id,
        userId: req.user!.id,
        question,
        answer: answer.answer,
        contextType: 'transcript',
        model: 'groq',
      },
    });

    res.json(answer);
  } catch (error) {
    console.error('Ask AI error:', error);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

export default router;
