import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { buildPreMeetingBrief } from '../services/intelligence.js';

const router = express.Router();

/**
 * POST /api/intelligence/pre-meeting
 * Build a pre-meeting brief from a title/description + attendee list. Works for
 * both calendar events and existing meetings (the client supplies attendees).
 */
router.post('/pre-meeting', requireAuth, async (req, res) => {
  try {
    const title = String(req.body?.title ?? '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const description =
      typeof req.body?.description === 'string' ? req.body.description : undefined;

    const attendees = Array.isArray(req.body?.attendees)
      ? req.body.attendees
          .map((a: unknown) => {
            if (typeof a === 'string') return { name: a };
            const obj = a as { name?: unknown; email?: unknown };
            return {
              name: String(obj?.name ?? '').trim(),
              email: typeof obj?.email === 'string' ? obj.email : null,
            };
          })
          .filter((a: { name: string }) => a.name.length > 0)
      : [];

    const result = await buildPreMeetingBrief(req.user!.id, { title, description, attendees });
    res.json(result);
  } catch (error) {
    console.error('Pre-meeting brief error:', error);
    res.status(500).json({ error: 'Failed to build pre-meeting brief' });
  }
});

export default router;
