import express from 'express';
import passport from '../lib/passport.js';
import { generateToken } from '../lib/jwt.js';
import type { User } from '@prisma/client';

const router = express.Router();
const DESKTOP_OAUTH_STATE = 'desktop';
const DESKTOP_PROTOCOL = process.env.DESKTOP_PROTOCOL || 'ai-meeting-copilot';
const APP_NAME = 'AI Meeting Copilot';

// ========================================
// Google OAuth Routes
// ========================================

/**
 * GET /auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', (req, res, next) => {
  const source = Array.isArray(req.query.source) ? req.query.source[0] : req.query.source;
  const isDesktop = source === 'desktop';

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    ...(isDesktop ? { state: DESKTOP_OAUTH_STATE } : {}),
  })(req, res, next);
});

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

      const userPayload = encodeURIComponent(
        JSON.stringify({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl })
      );

      const state = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
      const isDesktop = state === DESKTOP_OAUTH_STATE;

      // Desktop: bounce back via custom protocol so Electron app can capture it.
      if (isDesktop) {
        const deepLink = `${DESKTOP_PROTOCOL}://auth/callback?token=${token}&user=${userPayload}`;

        // NOTE: Redirecting directly to a custom protocol often leaves the browser tab in a
        // confusing "loading" state. Instead, return a small HTML page that triggers the deep link
        // and then shows a clear success message with a manual fallback.
        res
          .status(200)
          .setHeader('Content-Type', 'text/html; charset=utf-8')
          .setHeader('Cache-Control', 'no-store')
          .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Signed in</title>
    <style>
      :root { color-scheme: light dark; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; margin: 0; padding: 24px; }
      .card { max-width: 560px; margin: 0 auto; border: 1px solid rgba(125,125,125,0.25); border-radius: 14px; padding: 18px 18px 14px; }
      h1 { font-size: 18px; margin: 0 0 8px; }
      p { margin: 0 0 12px; line-height: 1.45; opacity: 0.9; }
      .row { display: flex; gap: 10px; flex-wrap: wrap; }
      a.btn { display: inline-block; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(125,125,125,0.35); text-decoration: none; }
      a.primary { background: #3B82F6; color: white; border-color: transparent; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; }
      .hint { font-size: 12px; opacity: 0.7; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Signed in successfully</h1>
      <p>We’re opening <strong>${APP_NAME}</strong> to complete sign-in. You can close this tab after the app opens.</p>
      <div class="row">
        <a class="btn primary" href="${deepLink}">Open the app</a>
        <a class="btn" href="${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/dashboard">Go to web app</a>
      </div>
      <p class="hint">If nothing happens, click “Open the app”. Some browsers will show a confirmation prompt.</p>
    </div>
    <script>
      // Auto-trigger the deep link shortly after load.
      // Using a timeout helps avoid some popup blockers treating this as an immediate redirect.
      setTimeout(function () {
        try { window.location.href = ${JSON.stringify(deepLink)}; } catch (e) {}
      }, 250);
    </script>
  </body>
</html>`);
      }

      // Web: redirect to frontend route; frontend stores token from URL.
      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&user=${userPayload}`);
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
