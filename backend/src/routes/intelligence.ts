import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { buildPreMeetingBrief } from '../services/intelligence.js';
import { researchGuests, hasLinkedinLayer } from '../services/guest-research.js';

const router = express.Router();

/** Parse the request's `attendees` into a clean { name, email }[] list. */
function parseAttendees(raw: unknown): Array<{ name: string; email: string | null }> {
  return Array.isArray(raw)
    ? raw
        .map((a: unknown) => {
          if (typeof a === 'string') return { name: a.trim(), email: null };
          const obj = a as { name?: unknown; email?: unknown };
          return {
            name: String(obj?.name ?? '').trim(),
            email: typeof obj?.email === 'string' ? obj.email : null,
          };
        })
        .filter((a: { name: string; email: string | null }) => a.name.length > 0 || Boolean(a.email))
    : [];
}

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

    const attendees = parseAttendees(req.body?.attendees).filter((a) => a.name.length > 0);

    // Briefs are cached; `refresh` lets the client force a rebuild on demand.
    const refresh = req.body?.refresh === true;

    const result = await buildPreMeetingBrief(
      req.user!.id,
      { title, description, attendees },
      { refresh }
    );
    res.json(result);
  } catch (error) {
    console.error('Pre-meeting brief error:', error);
    res.status(500).json({ error: 'Failed to build pre-meeting brief' });
  }
});

/**
 * POST /api/intelligence/research-guests
 * On-demand internet research on a meeting's external guests. Anchored on each
 * attendee's email; results are cached per-person in the Contact table. Always
 * available (free base); `providerConfigured` reports whether the LinkedIn layer
 * is wired for richer results.
 */
router.post('/research-guests', requireAuth, async (req, res) => {
  try {
    const attendees = parseAttendees(req.body?.attendees);
    const organizerEmail = req.user!.email;
    const guests = await researchGuests(organizerEmail, attendees);
    res.json({
      enabled: true,
      providerConfigured: hasLinkedinLayer(),
      guests,
    });
  } catch (error) {
    console.error('Guest research error:', error);
    res.status(500).json({ error: 'Failed to research guests' });
  }
});

export default router;
