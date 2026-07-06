import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import {
  createMeeting,
  addTranscriptLine,
  updateMeetingAudioBuffer,
  completeMeeting,
  findOwnedMeeting,
  getMeetingWithDetails,
  getUserMeetings,
  serializeMeetingForApi,
  deleteMeeting,
  searchMeetings,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
} from '../services/meeting.js';
import { processMeeting, reprocessMeeting } from '../services/processing.js';
import { answerMeetingQuestion } from '../services/ai.js';
import { transcribeAudioBuffer } from '../services/transcribe-file.js';
import { isCloudinaryConfigured } from '../services/cloudinary.js';
import { buildMeetingMarkdown, buildMeetingPdf } from '../services/export.js';
import { shareMeetingByEmail, shareMeetingToSlack } from '../services/share.js';
import { getRouteParam } from '../lib/params.js';
import { emailRecipientSchema } from '../lib/schemas.js';

/** In-memory upload for recorded/imported audio (uploaded on to Cloudinary). */
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

/** Filesystem-safe slug for download filenames. */
function safeName(name: string): string {
  return name.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'meeting';
}

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

    res.json({ meetings: meetings.map((m) => serializeMeetingForApi(m)) });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

/**
 * GET /api/meetings/search?q=
 * Semantic + keyword search across the user's meetings.
 * NOTE: must be registered before `/:id` so "search" is not treated as an id.
 */
router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const meetings = await searchMeetings(req.user!.id, q);
    res.json({ meetings: meetings.map((m) => serializeMeetingForApi(m)), query: q });
  } catch (error) {
    console.error('Search meetings error:', error);
    res.status(500).json({ error: 'Failed to search meetings' });
  }
});

/**
 * GET /api/meetings/:id
 * Get meeting details
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    const meeting = await getMeetingWithDetails(meetingId, req.user!.id);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ meeting: serializeMeetingForApi(meeting) });
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
 * POST /api/meetings/import
 * Import an audio file as a new meeting: create it, batch-transcribe with
 * Deepgram, store the audio, and run the normal processing pipeline. The heavy
 * work runs in the background so the client gets the new meeting id immediately
 * and can watch it move PROCESSING → COMPLETED.
 */
router.post('/import', requireAuth, audioUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
    const userId = req.user!.id;
    const audioBuffer = req.file.buffer;
    const title =
      (req.file.originalname || '').replace(/\.[^.]+$/, '').trim().slice(0, 80) ||
      'Imported audio';

    const meeting = await createMeeting({ userId, title, startTime: new Date() });
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: 'PROCESSING', recordingStarted: new Date() },
    });

    // Respond now; transcription + processing continue in the background.
    res.json({ meeting });

    void (async () => {
      try {
        const lines = await transcribeAudioBuffer(audioBuffer);
        for (const line of lines) {
          await addTranscriptLine(meeting.id, line);
        }
        if (isCloudinaryConfigured()) {
          await updateMeetingAudioBuffer(meeting.id, audioBuffer).catch(() => {});
        }
        await processMeeting(meeting.id);
      } catch (err) {
        console.error('[import] failed:', err);
        await prisma.meeting
          .update({
            where: { id: meeting.id },
            data: {
              status: 'FAILED',
              processingError: err instanceof Error ? err.message : 'Import failed',
            },
          })
          .catch((statusErr) => {
            // Worst case: the meeting is stuck in PROCESSING — make it loud.
            console.error(
              `[import] CRITICAL: failed to mark meeting ${meeting.id} as FAILED (stuck in PROCESSING):`,
              statusErr
            );
          });
      }
    })();
  } catch (error) {
    console.error('Import audio error:', error);
    res.status(500).json({ error: 'Failed to import audio' });
  }
});

/**
 * POST /api/meetings/:id/transcript
 * Add transcript line to meeting
 */
router.post('/:id/transcript', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    if (!(await findOwnedMeeting(meetingId, req.user!.id))) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    const { speaker, text, timestamp, timestampSeconds, confidence, highlighted } = req.body;

    if (!speaker || !text || !timestamp || timestampSeconds === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const transcriptLine = await addTranscriptLine(meetingId, {
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
    const meetingId = getRouteParam(req.params.id);

    const { meeting, claimed } = await completeMeeting(meetingId, req.user!.id);

    // Trigger async processing only when this call won the LIVE→PROCESSING
    // claim; otherwise the abandoned-session finalizer already owns it.
    if (claimed) {
      processMeeting(meetingId).catch((error) => {
        console.error('Background processing error:', error);
      });
    }

    res.json({ meeting, processing: claimed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete meeting';
    const status = message.includes('not found') ? 404 : 500;
    console.error('Complete meeting error:', error);
    res.status(status).json({ error: status === 404 ? 'Meeting not found' : 'Failed to complete meeting' });
  }
});

/**
 * POST /api/meetings/:id/audio
 * Store the recorded audio blob for a meeting (multipart field "audio") so the
 * detail page plays real audio. No-op (200) if Cloudinary isn't configured.
 */
router.post('/:id/audio', requireAuth, audioUpload.single('audio'), async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    const owned = await prisma.meeting.findFirst({
      where: { id: meetingId, userId: req.user!.id },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ error: 'Meeting not found' });
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

    if (!isCloudinaryConfigured()) {
      // Audio storage not configured — succeed quietly, playback stays demo.
      return res.json({ audioUrl: null, stored: false });
    }

    const meeting = await updateMeetingAudioBuffer(meetingId, req.file.buffer);
    res.json({ audioUrl: meeting.audioUrl, stored: true });
  } catch (error) {
    console.error('Upload meeting audio error:', error);
    res.status(500).json({ error: 'Failed to upload audio' });
  }
});

/**
 * POST /api/meetings/:id/reprocess
 * Reprocess meeting AI content
 */
router.post('/:id/reprocess', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    const result = await reprocessMeeting(meetingId, req.user!.id);
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
    const meetingId = getRouteParam(req.params.id);
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const meeting = await getMeetingWithDetails(meetingId, req.user!.id);

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

/**
 * PATCH /api/meetings/:id
 * Update meeting metadata (currently title only; verifies ownership).
 */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    if (!(await findOwnedMeeting(meetingId, req.user!.id))) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > 200) {
      return res.status(400).json({ error: 'Title must be 1-200 characters' });
    }

    const meeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: { title },
    });
    res.json({ meeting: serializeMeetingForApi(meeting) });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

/**
 * DELETE /api/meetings/:id
 * Delete a meeting and all related data (verifies ownership).
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    await deleteMeeting(meetingId, req.user!.id);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete meeting';
    const status = message.includes('not found') ? 404 : 500;
    console.error('Delete meeting error:', error);
    res.status(status).json({ error: message });
  }
});

// ========================================
// Export (Markdown / PDF)
// ========================================

router.get('/:id/export.md', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    const meeting = await getMeetingWithDetails(meetingId, req.user!.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const md = buildMeetingMarkdown(serializeMeetingForApi(meeting)!);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName(meeting.title)}.md"`);
    res.send(md);
  } catch (error) {
    console.error('Export markdown error:', error);
    res.status(500).json({ error: 'Failed to export meeting' });
  }
});

router.get('/:id/export.pdf', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    const meeting = await getMeetingWithDetails(meetingId, req.user!.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const pdf = await buildMeetingPdf(serializeMeetingForApi(meeting)!);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName(meeting.title)}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('Export PDF error:', error);
    res.status(500).json({ error: 'Failed to export meeting' });
  }
});

// ========================================
// Sharing (Email / Slack)
// ========================================

router.post('/:id/share/email', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    const recipients: string[] = Array.isArray(req.body?.recipients)
      ? req.body.recipients.map((r: unknown) => String(r).trim()).filter(Boolean)
      : [];
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }
    const invalid = recipients.filter((r) => !emailRecipientSchema.safeParse(r).success);
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Invalid email address: ${invalid.join(', ')}` });
    }

    const meeting = await getMeetingWithDetails(meetingId, req.user!.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    await shareMeetingByEmail(req.user!.id, meetingId, serializeMeetingForApi(meeting)!, recipients);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    // A missing Gmail integration is a user-actionable 400, not a server error.
    const status = /not found or inactive/i.test(message) ? 400 : 500;
    console.error('Share email error:', error);
    res.status(status).json({
      error: status === 400 ? 'Connect Gmail in Settings to email meeting reports.' : message,
    });
  }
});

router.post('/:id/share/slack', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    const channel = String(req.body?.channel ?? '').trim();
    if (!channel) return res.status(400).json({ error: 'A Slack channel is required' });

    const meeting = await getMeetingWithDetails(meetingId, req.user!.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    await shareMeetingToSlack(meetingId, serializeMeetingForApi(meeting)!, channel);
    res.json({ success: true });
  } catch (error) {
    console.error('Share slack error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to post to Slack',
    });
  }
});

// ========================================
// Meeting Notes (personal notes)
// ========================================

router.get('/:id/notes', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    const notes = await listNotes(meetingId, req.user!.id);
    res.json({ notes });
  } catch (error) {
    console.error('List notes error:', error);
    res.status(500).json({ error: 'Failed to list notes' });
  }
});

router.post('/:id/notes', requireAuth, async (req, res) => {
  try {
    const meetingId = getRouteParam(req.params.id);
    const content = String(req.body?.content ?? '').trim();
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const note = await createNote(meetingId, req.user!.id, {
      content,
      contentHtml: typeof req.body?.contentHtml === 'string' ? req.body.contentHtml : null,
    });
    res.json({ note });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create note';
    const status = message.includes('not found') ? 404 : 500;
    console.error('Create note error:', error);
    res.status(status).json({ error: message });
  }
});

router.patch('/notes/:noteId', requireAuth, async (req, res) => {
  try {
    const noteId = getRouteParam(req.params.noteId);
    const content = String(req.body?.content ?? '').trim();
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const note = await updateNote(noteId, req.user!.id, {
      content,
      contentHtml: typeof req.body?.contentHtml === 'string' ? req.body.contentHtml : null,
    });
    res.json({ note });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update note';
    const status = message.includes('not found') ? 404 : 500;
    console.error('Update note error:', error);
    res.status(status).json({ error: message });
  }
});

router.delete('/notes/:noteId', requireAuth, async (req, res) => {
  try {
    const noteId = getRouteParam(req.params.noteId);
    await deleteNote(noteId, req.user!.id);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete note';
    const status = message.includes('not found') ? 404 : 500;
    console.error('Delete note error:', error);
    res.status(status).json({ error: message });
  }
});

export default router;
