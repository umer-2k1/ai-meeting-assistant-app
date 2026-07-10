import './load-env.js';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, type WebSocket } from 'ws';
import passport from './lib/passport.js';
import authRoutes from './routes/auth.js';
import meetingsRoutes from './routes/meetings.js';
import liveRoutes from './routes/live.js';
import integrationsRoutes from './routes/integrations.js';
import intelligenceRoutes from './routes/intelligence.js';
import userRoutes from './routes/user.js';
import { requireAuth } from './middleware/auth.js';
import {
  getAuthConfigIssues,
  getJwtSecret,
  isGoogleOAuthConfigured,
} from './lib/auth-config.js';
import { validateEnvOrExit } from './lib/validate-env.js';
import prisma from './lib/prisma.js';
import { answerWithTools } from './services/ai-agent.js';
import {
  sweepOrphanedLiveMeetings,
  finalizeAbandonedMeeting,
  findIdleLiveMeetings,
} from './services/meeting.js';
import { processMeeting } from './services/processing.js';
import { authorizeStreamUpgrade, WS_SUBPROTOCOL } from './lib/ws-auth.js';
import {
  createLiveTranscriptionSession,
  type TranscriptMessage,
} from './services/live-transcription.js';
import { createLogger, shortId } from './lib/logger.js';

const wsLog = createLogger('ws');

// Fail fast if required credentials are missing (before anything else runs).
validateEnvOrExit();

const app = express();
const port = Number(process.env.PORT ?? 3001);

// ========================================
// Middleware
// ========================================

// Security headers. crossOriginResourcePolicy relaxed so the SPA (different
// origin/port in dev) can consume API responses and downloads.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Rate limit the API surface (WS upgrades bypass Express and are unaffected).
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json({ limit: '2mb' }));
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
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/user', userRoutes);

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
// Live transcription WebSocket
// ========================================

function attachLiveTranscriptionWs(server: http.Server) {
  const wss = new WebSocketServer({
    noServer: true,
    // The client offers ["meeting-stream", <jwt>]; select the tag so the
    // browser accepts the handshake (the jwt is read in ws-auth, not selected).
    handleProtocols: (protocols) => (protocols.has(WS_SUBPROTOCOL) ? WS_SUBPROTOCOL : false),
  });

  server.on('upgrade', (request, socket, head) => {
    // Only handle the live-stream path; ignore other upgrades.
    void (async () => {
      const auth = await authorizeStreamUpgrade(request).catch(() => null);
      if (!auth) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, auth);
      });
    })();
  });

  wss.on('connection', (ws: WebSocket, _request: http.IncomingMessage, auth: { meetingId: string }) => {
    wsLog.ok(`client connected — streaming audio for meeting ${shortId(auth.meetingId)}`);
    const emit = (message: TranscriptMessage) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
    };

    const session = createLiveTranscriptionSession({ meetingId: auth.meetingId, emit });

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        session.sendAudio(data);
        return;
      }
      // JSON control frames (e.g. {"type":"stop"}).
      try {
        const msg = JSON.parse(data.toString());
        if (msg?.type === 'stop') session.close();
      } catch {
        /* ignore non-JSON text frames */
      }
    });

    const finalizeIfAbandoned = () => {
      wsLog.info(`client disconnected for meeting ${shortId(auth.meetingId)} — closing transcription session`);
      session.close();
      // If the socket closed without an explicit /complete (app closed, crashed,
      // navigated away), finalize the meeting so it doesn't get stuck LIVE. The
      // delay lets the normal stop flow (/complete) win; finalizeAbandonedMeeting
      // is atomic + status-guarded so processing runs at most once. The delay also
      // gives any in-flight final transcript lines time to persist first.
      const { meetingId } = auth;
      setTimeout(() => {
        void finalizeAbandonedMeeting(meetingId)
          .then(({ process }) => {
            if (process) {
              wsLog.step(`meeting ${shortId(meetingId)} ended without /complete — finalizing + processing`);
              void processMeeting(meetingId).catch((error) =>
                wsLog.error(`processing failed for ${shortId(meetingId)}`, error instanceof Error ? error.message : error)
              );
            }
          })
          .catch((error) => wsLog.error(`finalize failed for ${shortId(meetingId)}`, error instanceof Error ? error.message : error));
      }, 4000);
    };

    ws.on('close', finalizeIfAbandoned);
    ws.on('error', finalizeIfAbandoned);
  });
}

// How long a LIVE meeting can go without transcript activity before the watchdog
// finalizes it, and how often the watchdog checks. The WS-close finalizer and
// startup sweep don't cover a session left open in a background tab (socket stays
// open, /complete never fires) — this guarantees such meetings can't stick at LIVE.
const LIVE_IDLE_TIMEOUT_MS = Number(process.env.LIVE_IDLE_TIMEOUT_MS ?? 3 * 60_000);
const LIVE_WATCHDOG_INTERVAL_MS = Number(process.env.LIVE_WATCHDOG_INTERVAL_MS ?? 60_000);

/**
 * Periodically finalize idle LIVE meetings. Reuses the same atomic, idempotent
 * finalizer the WS-close path uses, so it races safely with `/complete`.
 */
function startLiveMeetingWatchdog() {
  const timer = setInterval(() => {
    void findIdleLiveMeetings(LIVE_IDLE_TIMEOUT_MS)
      .then(async (meetingIds) => {
        for (const meetingId of meetingIds) {
          const { process: shouldProcess } = await finalizeAbandonedMeeting(meetingId);
          if (shouldProcess) {
            console.log(`[watchdog] finalizing idle LIVE meeting ${meetingId}`);
            void processMeeting(meetingId).catch((error) =>
              console.error(`[watchdog] processing failed for ${meetingId}:`, error)
            );
          }
        }
      })
      .catch((error) => console.error('[watchdog] idle sweep failed:', error));
  }, LIVE_WATCHDOG_INTERVAL_MS);
  // Don't keep the event loop alive just for the watchdog.
  timer.unref();
  return timer;
}

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

  // Clean up LIVE meetings orphaned by a crash or an abandoned session (nothing
  // can still be recording after a restart). Empty ones are deleted; ones with
  // transcript are finished off in the background.
  try {
    const orphaned = await sweepOrphanedLiveMeetings();
    for (const meetingId of orphaned) {
      void processMeeting(meetingId).catch((error) => {
        console.error(`[startup] Failed to finish orphaned meeting ${meetingId}:`, error);
      });
    }
  } catch (error) {
    console.error('[startup] Orphaned-meeting sweep failed:', error);
  }

  // Catch sessions abandoned with the tab still open (WS never closes) — these
  // are invisible to the WS-close finalizer and the boot-time sweep.
  startLiveMeetingWatchdog();

  const server = http.createServer(app);
  attachLiveTranscriptionWs(server);

  server.on('listening', () => {
    console.log(`🚀 AI Meeting Copilot Backend running on http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
    console.log(`🔐 Auth endpoint: http://localhost:${port}/auth/google`);
    console.log(`🎙️  Live transcription WS: ws://localhost:${port}/api/live/:meetingId/stream`);
  });

  server.listen(port);

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
