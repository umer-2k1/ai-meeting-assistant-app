import express from 'express';
import passport from '../lib/passport.js';
import { generateToken } from '../lib/jwt.js';
import {
  buildAuthErrorRedirect,
  getFrontendUrl,
  isGoogleOAuthConfigured,
  mapAuthErrorToReason,
} from '../lib/auth-config.js';
import type { User } from '@prisma/client';

const router = express.Router();
const DESKTOP_OAUTH_STATE = 'desktop';
const DESKTOP_PROTOCOL = process.env.DESKTOP_PROTOCOL || 'ai-meeting-copilot';

function redirectWithAuthSuccess(req: express.Request, res: express.Response, user: User) {
  const token = generateToken(user);

  const userPayload = encodeURIComponent(
    JSON.stringify({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl })
  );

  const state = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
  const isDesktop = state === DESKTOP_OAUTH_STATE;

  if (isDesktop) {
    const deepLink = `${DESKTOP_PROTOCOL}://auth/callback?token=${token}&user=${userPayload}`;
    return res.redirect(deepLink);
  }

  return res.redirect(`${getFrontendUrl()}/auth/callback?token=${token}&user=${userPayload}`);
}

// ========================================
// Google OAuth Routes
// ========================================

/**
 * GET /auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', (req, res, next) => {
  if (!isGoogleOAuthConfigured()) {
    return res.redirect(buildAuthErrorRedirect('oauth_misconfigured'));
  }

  const source = Array.isArray(req.query.source) ? req.query.source[0] : req.query.source;
  const isDesktop = source === 'desktop';

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    prompt: 'select_account',
    ...(isDesktop ? { state: DESKTOP_OAUTH_STATE } : {}),
  })(req, res, next);
});

/**
 * GET /auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err) {
      console.error('Google OAuth callback error:', err);
      const reason = mapAuthErrorToReason(err);
      return res.redirect(buildAuthErrorRedirect(reason));
    }

    if (!user) {
      return res.redirect(buildAuthErrorRedirect('auth_failed'));
    }

    try {
      return redirectWithAuthSuccess(req, res, user as User);
    } catch (error) {
      console.error('Auth callback error:', error);
      const reason = mapAuthErrorToReason(error);
      return res.redirect(buildAuthErrorRedirect(reason));
    }
  })(req, res, next);
});

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
  res.json({ message: 'Logged out successfully' });
});

export default router;
