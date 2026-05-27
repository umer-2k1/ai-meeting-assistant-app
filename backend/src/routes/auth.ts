import express from 'express';
import passport from '../lib/passport.js';
import { generateToken } from '../lib/jwt.js';
import type { User } from '@prisma/client';

const router = express.Router();

// ========================================
// Google OAuth Routes
// ========================================

/**
 * GET /auth/google
 * Initiate Google OAuth flow
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

/**
 * GET /auth/google/callback
 * Handle Google OAuth callback
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error`,
  }),
  (req, res) => {
    try {
      const user = req.user as User;

      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
      }

      // Generate JWT token
      const token = generateToken(user);

      // Redirect to frontend with token
      // Frontend will extract token from URL and store it
      res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl }))}`
      );
    } catch (error) {
      console.error('Auth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
    }
  }
);

/**
 * GET /auth/me
 * Get current user (requires authentication)
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const { verifyToken } = await import('../lib/jwt.js');
    const payload = verifyToken(token);

    const { default: prisma } = await import('../lib/prisma.js');
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        timezone: true,
        language: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * POST /auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', (req, res) => {
  // With JWT, logout is handled client-side by removing the token
  // This endpoint exists for consistency
  res.json({ message: 'Logged out successfully' });
});

export default router;
