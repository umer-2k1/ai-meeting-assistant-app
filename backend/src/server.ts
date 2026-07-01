import './load-env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from './lib/passport.js';
import authRoutes from './routes/auth.js';
import { requireAuth, optionalAuth } from './middleware/auth.js';
import { getRouteParam } from './lib/params.js';
import { sampleMeetings, sampleTranscript } from './data.js';
import {
  getAuthConfigIssues,
  getJwtSecret,
  isGoogleOAuthConfigured,
} from './lib/auth-config.js';
import prisma from './lib/prisma.js';
import { answerWithTools } from './services/ai-agent.js';

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
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
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

  if (process.env.DATABASE_URL) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseConnected = true;
    } catch (error) {
      console.error('[health] Database connection failed:', error);
    }
  }

  response.json({
    ok: true,
    service: 'ai-meeting-copilot-backend',
    googleOAuthConfigured: isGoogleOAuthConfigured(),
    jwtConfigured: Boolean(getJwtSecret()),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    databaseConnected,
    authConfigIssues: authIssues,
  });
});

// Auth routes (no /api prefix for auth)
app.use('/auth', authRoutes);

// API routes
import meetingsRoutes from './routes/meetings.js';
import liveRoutes from './routes/live.js';
import integrationsRoutes from './routes/integrations.js';
app.use('/api/meetings', meetingsRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/integrations', integrationsRoutes);

// Legacy endpoints - kept for backward compatibility with mock data fallback
// Legacy endpoints - kept for backward compatibility with mock data fallback
// These will be deprecated in favor of /api/meetings routes
app.get('/api/meetings-legacy', optionalAuth, async (request, response) => {
  try {
    // If user is authenticated, fetch from database
    if (request.user) {
      const { default: prisma } = await import('./lib/prisma.js');
      const meetings = await prisma.meeting.findMany({
        where: { userId: request.user.id },
        include: {
          attendees: true,
          tags: true,
          _count: {
            select: {
              actionItems: true,
              transcript: true,
            },
          },
        },
        orderBy: { startTime: 'desc' },
        take: 50,
      });

      return response.json({ meetings });
    }

    // Fallback to mock data for unauthenticated users
    response.json({ meetings: sampleMeetings });
  } catch (error) {
    console.error('Get meetings error:', error);
    // Fallback to mock data on error
    response.json({ meetings: sampleMeetings });
  }
});

app.get('/api/meetings/:meetingId/transcript', optionalAuth, async (request, response) => {
  try {
    const meetingId = getRouteParam(request.params.meetingId);

    // If user is authenticated, fetch from database
    if (request.user) {
      const { default: prisma } = await import('./lib/prisma.js');
      const meeting = await prisma.meeting.findFirst({
        where: {
          id: meetingId,
          userId: request.user.id,
        },
        include: {
          transcript: { orderBy: { timestampSeconds: 'asc' } },
        },
      });

      if (!meeting) {
        return response.status(404).json({ error: 'Meeting not found' });
      }

      return response.json({
        meetingId: meeting.id,
        transcript: meeting.transcript,
      });
    }

    // Fallback to mock data
    const meeting = sampleMeetings.find((entry) => entry.id === meetingId);
    if (!meeting) {
      response.status(404).json({ error: 'Meeting not found' });
      return;
    }

    response.json({
      meetingId: meeting.id,
      transcript: sampleTranscript,
    });
  } catch (error) {
    console.error('Get transcript error:', error);
    response.status(500).json({ error: 'Failed to fetch transcript' });
  }
});

app.post('/api/ask-meeting', optionalAuth, async (request, response) => {
  const meetingId = String(request.body?.meetingId ?? '');
  const question = String(request.body?.question ?? '');
  const transcript = Array.isArray(request.body?.transcript) ? request.body.transcript : [];
  const actionItems = Array.isArray(request.body?.actionItems) ? request.body.actionItems : [];
  const summary = typeof request.body?.summary === 'string' ? request.body.summary : undefined;

  if (!question.trim()) {
    response.status(400).json({ error: 'Question is required.' });
    return;
  }

  // Real AI path: authenticated user + Groq configured. This lets the model call
  // the Calendar/Gmail MCP tools (see backend/src/services/ai-agent.ts) in addition
  // to answering from the transcript/summary/action items passed in the request.
  if (request.user && process.env.GROQ_API_KEY) {
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

      const { answer, toolCalls } = await answerWithTools(request.user.id, question, {
        transcript: transcriptText || undefined,
        summary,
        actionItems: actionItemsText || undefined,
      });

      response.json({ answer, toolCalls });
      return;
    } catch (error) {
      console.error('AI agent error, falling back to keyword matching:', error);
      // Fall through to the deterministic mock below so the endpoint still responds.
    }
  }

  // Fallback for dev/demo environments without GROQ_API_KEY or without an
  // authenticated user (e.g. web preview without sign-in).
  const normalized = question.toLowerCase();

  if (normalized.includes('who') && normalized.includes('pricing')) {
    response.json({
      answer:
        'Sarah mentioned pricing and suggested revisiting enterprise-tier pricing before Q3 execution.',
      timestamp: '00:14:32',
    });
    return;
  }

  if (normalized.includes('action')) {
    const summarized = actionItems
      .slice(0, 3)
      .map((item: { assignee?: string; task?: string }) => `@${item.assignee ?? 'Owner'}: ${item.task ?? 'Task'}`)
      .join('; ');

    response.json({
      answer:
        summarized.length > 0
          ? `Action items detected: ${summarized}.`
          : 'Action items include finalizing tech specs and updating help center articles.',
      timestamp: actionItems[0]?.timestamp ?? '00:18:45',
    });
    return;
  }

  if (normalized.includes('disagree') || normalized.includes('timeline')) {
    const disagreement = transcript.find((line: { text?: string }) => {
      const content = String(line.text ?? '').toLowerCase();
      return content.includes('disagree') || content.includes('timeline') || content.includes('concern');
    });

    response.json({
      answer:
        disagreement?.text ??
        'Sarah raised concerns about the timeline and requested a safer rollout window.',
      timestamp: disagreement?.timestamp ?? '00:02:20',
    });
    return;
  }

  response.json({
    answer:
      meetingId === 'meeting-1'
        ? 'The Product Sync discussion focused on Q3 priorities, Dark Mode launch alignment, and API latency risk management.'
        : 'The meeting focused on priorities, ownership decisions, and concrete follow-up actions.',
    timestamp: '00:01:02',
  });
});

// ========================================
// Error Handling
// ========================================

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

  if (process.env.DATABASE_URL) {
    try {
      await prisma.$connect();
      console.log('[startup] Database connection established');
    } catch (error) {
      console.error('[startup] Failed to connect to database:', error);
      console.error('[startup] Google sign-in and database features will fail until DATABASE_URL is fixed.');
    }
  } else {
    console.warn('[startup] DATABASE_URL is not set. Google sign-in will fail.');
  }

  const server = app.listen(port);

  server.on('listening', () => {
    console.log(`🚀 AI Meeting Copilot Backend running on http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
    console.log(`🔐 Auth endpoint: http://localhost:${port}/auth/google`);
    console.log(`\n💡 To enable database features, set DATABASE_URL in .env`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n[startup] Port ${port} is already in use by another process.`);
      console.error('[startup] Google sign-in will hang until this backend is actually listening.');
      console.error(`[startup] Free the port: lsof -i :${port}`);
      console.error(`[startup] Or set a different PORT in backend/.env (and update VITE_BACKEND_URL in frontend/.env).`);
    } else {
      console.error('[startup] Failed to start server:', error);
    }
    process.exit(1);
  });
}

void startServer();
