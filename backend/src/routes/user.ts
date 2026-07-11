import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import {
  parsePreferences,
  preferencesSchema,
  serializePreferences,
} from '../lib/preferences.js';

const router = express.Router();

/**
 * GET /api/user/preferences
 * Return the current user's preferences (defaults if none saved yet).
 */
router.get('/preferences', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { preferences: true },
    });
    res.json({ preferences: parsePreferences(user?.preferences) });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to load preferences' });
  }
});

/**
 * PUT /api/user/preferences
 * Merge a partial preferences update over the saved set and persist it.
 * Accepts either `{ preferences: {...} }` or the fields directly.
 */
router.put('/preferences', requireAuth, async (req, res) => {
  try {
    const body = (req.body?.preferences ?? req.body) as unknown;
    const partial = preferencesSchema.partial().safeParse(body);
    if (!partial.success) {
      return res.status(400).json({ error: 'Invalid preferences' });
    }

    const current = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { preferences: true },
    });
    const merged = { ...parsePreferences(current?.preferences), ...partial.data };
    const serialized = serializePreferences(merged);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { preferences: serialized },
    });

    res.json({ preferences: JSON.parse(serialized) });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

export default router;
