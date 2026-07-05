import './load-env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from './lib/passport.js';
import authRoutes from './routes/auth.js';
import meetingsRoutes from './routes/meetings.js';
import liveRoutes from './routes/live.js';
import integrationsRoutes from './routes/integrations.js';
import { requireAuth } from './middleware/auth.js';
import {
  getAuthConfigIssues,
  getJwtSecret,
  isGoogleOAuthConfigured,
} from './lib/auth-config.js';
import { validateEnvOrExit } from './lib/validate-env.js';
import prisma from './lib/prisma.js';
import { answerWithTools } from './services/ai-agent.js';

// Fail fast if required credentials are missing (before anything else runs).
validateEnvOrExit();

const app = express();
const port = Number(process.env.PORT ?? 3001);

// ========================================
// Middleware
// ========================================

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware (for OAuth flow)
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// ========================================
// Routes
// ========================================

// Health check
app.get('/api/health', async (_request, response) => {
  const authIssues = getAuthConfigIssues();
  let databaseConnected = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseConnected = true;
  } catch (error) {
    console.error('[health] Database connection failed:', error);
  }

  response.json({
    ok: true,
    service: 'ai-meeting-copilot-backend',
    googleOAuthConfigured: isGoogleOAuthConfigured(),
    jwtConfigured: Boolean(getJwtSecret()),
    databaseConnected,
    authConfigIssues: authIssues,
  });
});

// Auth routes (no /api prefix for auth)
app.use('/auth', authRoutes);

// API routes
app.use('/api/meetings', meetingsRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/integrations', integrationsRoutes);

/**
 * POST /api/ask-meeting
 * Agentic AI chat with access to the user's Calendar/Gmail MCP tools
 * (see services/ai-agent.ts). Requires an authenticated user; there is no
 * mock fallback — a real Groq call always backs this endpoint.
 */
app.post('/api/ask-meeting', requireAuth, async (request, response) => {
  const question = String(request.body?.question ?? '').trim();
  const transcript = Array.isArray(request.body?.transcript) ? request.body.transcript : [];
  const actionItems = Array.isArray(request.body?.actionItems) ? request.body.actionItems : [];
  const summary = typeof request.body?.summary === 'string' ? request.body.summary : undefined;

  if (!question) {
    return response.status(400).json({ error: 'Question is required.' });
  }

  try {
    const transcriptText = transcript
      .map((line: { speaker?: string; text?: string; timestamp?: string }) =>
        `[${line.timestamp ?? '??:??:??'}] ${line.speaker ?? 'Speaker'}: ${line.text ?? ''}`
      )
      .join('\n');

    const actionItemsText = actionItems
      .map((item: { assignee?: string; task?: string; timestamp?: string }) =>
        `- ${item.task ?? 'Task'} (assignee: ${item.assignee ?? 'unassigned'}${item.timestamp ? `, ${item.timestamp}` : ''})`
      )
      .join('\n');

    const { answer, toolCalls } = await answerWithTools(request.user!.id, question, {
      transcript: transcriptText || undefined,
      summary,
      actionItems: actionItemsText || undefined,
    });

    response.json({ answer, toolCalls });
  } catch (error) {
    console.error('AI agent error:', error);
    response.status(500).json({ error: 'Failed to answer question.' });
  }
});

// ========================================
// Error Handling
// ========================================

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ========================================
// Server Start
// ========================================

async function startServer() {
  const authIssues = getAuthConfigIssues();

  if (authIssues.length > 0) {
    console.warn('[startup] Auth configuration issues detected:');
    for (const issue of authIssues) {
      console.warn(`  - ${issue}`);
    }
  }

  try {
    await prisma.$connect();
    console.log('[startup] Database connection established');
  } catch (error) {
    console.error('[startup] Failed to connect to database:', error);
    console.error('[startup] Run `npm run db:migrate` (or `db:push`) to create the SQLite database.');
    process.exit(1);
  }

  const server = app.listen(port);

  server.on('listening', () => {
    console.log(`🚀 AI Meeting Copilot Backend running on http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
    console.log(`🔐 Auth endpoint: http://localhost:${port}/auth/google`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n[startup] Port ${port} is already in use by another process.`);
      console.error(`[startup] Free the port: lsof -i :${port}`);
      console.error(`[startup] Or set a different PORT in backend/.env (and update VITE_BACKEND_URL in frontend/.env).`);
    } else {
      console.error('[startup] Failed to start server:', error);
    }
    process.exit(1);
  });
}

void startServer();
