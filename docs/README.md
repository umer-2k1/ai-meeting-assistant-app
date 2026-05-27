# AI Meeting Copilot - Implementation Architecture

## Overview

Production-ready AI-powered meeting assistant with real-time transcription, intelligent insights, and seamless integrations.

**Status:** Phase 1-4 Complete ✅

---

## Tech Stack

### Frontend
- **Framework:** React + TypeScript + Vite
- **UI:** Tailwind CSS + Shadcn UI
- **Desktop:** Electron (macOS/Windows/Linux)
- **State:** React Context + Zustand
- **Routing:** React Router v7
- **Rich Text:** Tiptap Editor

### Backend
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL + Prisma ORM
- **Authentication:** Google OAuth 2.0 + JWT
- **File Storage:** Cloudinary

### AI & Intelligence Layer
- **LLM:** Groq (llama-3.3-70b-versatile)
- **Orchestration:** LangChain + LangGraph
- **Embeddings:** Google Gemini (text-embedding-004)
- **Vector DB:** Qdrant
- **Speech-to-Text:** Deepgram Nova-2

---

## System Architecture

```
┌─────────────────┐
│   Electron App  │
│   (Frontend)    │
│                 │
│  - Audio Capture│
│  - UI/UX        │
│  - Auth Context │
└────────┬────────┘
         │
         │ IPC / HTTP
         │
┌────────▼────────────────────────────────┐
│          Backend API Server             │
│                                          │
│  Authentication    Recording Management │
│  Meeting CRUD      AI Processing        │
│  Transcript Store  Vector Search        │
└───┬──────────┬──────────┬──────────┬───┘
    │          │          │          │
┌───▼──┐  ┌───▼──┐  ┌───▼──┐  ┌───▼──┐
│ PSQL │  │ Groq │  │Gemini│  │Qdrant│
│  DB  │  │ LLM  │  │ Emb  │  │Vector│
└──────┘  └──────┘  └──────┘  └──────┘
             │          │
        ┌────▼──────────▼────┐
        │    Cloudinary      │
        │  (Audio Storage)   │
        └────────────────────┘
```

---

## Database Schema

### Core Tables
- **Users** - OAuth profiles, preferences
- **Meetings** - Title, times, status, AI summary
- **MeetingAttendees** - Name, email, role, enrichment
- **TranscriptLines** - Speaker, text, timestamp, confidence
- **ActionItems** - Task, assignee, priority, due date
- **AIChatMessages** - Question/answer history
- **MeetingNotes** - User's personal notes
- **MeetingTags** - Categorization
- **VectorEmbeddings** - Qdrant tracking
- **IntegrationLogs** - Export/share audit trail

[See full schema: `backend/prisma/schema.prisma`]

---

## Key Features Implemented

### ✅ Phase 1: Authentication
- Google OAuth 2.0 login flow
- JWT-based session management
- Protected routes (frontend + backend)
- Auth context provider
- User profile management

### ✅ Phase 2: Real Audio Recording
- Electron audio capture service
- Deepgram live transcription streaming
- Speaker diarization
- Pause/resume/stop controls
- System tray integration
- Floating widget (compact/expanded modes)

### ✅ Phase 3: Database & Storage
- PostgreSQL with Prisma ORM
- Complete relational data model
- Cloudinary audio file storage
- Automatic upload + cleanup
- Migration scripts + seed data

### ✅ Phase 4: AI Intelligence Layer
- **LangChain + Groq LLM:**
  - Meeting summary generation
  - Action item extraction
  - Q&A over meetings
  - Pre-meeting brief generation

- **Gemini Embeddings + Qdrant:**
  - Semantic meeting search
  - Transcript snippet search
  - Vector storage + retrieval
  - Auto-indexing pipeline

- **Post-Meeting Processing:**
  - AI summary (2-3 sentences)
  - Key discussion points
  - Decisions made
  - Risks/blockers identified
  - Action item extraction with priority
  - Full vector indexing (meetings + transcripts)

---

## API Endpoints

### Authentication
- `GET /auth/google` - Initiate OAuth flow
- `GET /auth/google/callback` - OAuth callback
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout

### Meetings
- `GET /api/meetings` - List user's meetings
- `GET /api/meetings/:id` - Get meeting details
- `POST /api/meetings` - Create meeting
- `POST /api/meetings/:id/transcript` - Add transcript line
- `POST /api/meetings/:id/complete` - Complete & process
- `POST /api/meetings/:id/ask` - Ask AI question
- `POST /api/meetings/:id/reprocess` - Regenerate AI content

---

## Environment Variables

### Required API Keys
```
# Database
DATABASE_URL=postgresql://...

# Authentication
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
SESSION_SECRET=

# AI Services
GROQ_API_KEY=
GOOGLE_GEMINI_API_KEY=
DEEPGRAM_API_KEY=

# Storage
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Vector Store
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
```

[See `.env.example` files for complete list]

---

## Development Setup

### Prerequisites
- Node.js ≥22.13
- PostgreSQL
- Qdrant (Docker or Cloud)
- API keys for all services

### Quick Start

```bash
# 1. Clone and install
pnpm install

# 2. Set up environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with your API keys

# 3. Start PostgreSQL + Qdrant
docker-compose up -d  # (if using Docker)

# 4. Initialize database
cd backend
pnpm db:push
pnpm db:seed

# 5. Start backend
pnpm dev

# 6. Start frontend (new terminal)
cd ../frontend
pnpm dev

# 7. Start Electron desktop (new terminal)
cd frontend
pnpm desktop:dev
```

---

## Recording Flow

### Live Recording Process

1. **User clicks "Start Recording"**
   - Frontend triggers `startRecording()`
   - Electron requests microphone permission (macOS)

2. **Audio Capture Begins**
   - `AudioRecordingService` initializes
   - Creates `MediaRecorder` for local file
   - Opens Deepgram WebSocket connection

3. **Real-Time Transcription**
   - Audio chunks sent to Deepgram
   - Transcript lines streamed back via IPC
   - Frontend updates live transcript view

4. **User clicks "Stop"**
   - Audio saved locally as `.webm`
   - Deepgram connection closed
   - Backend API called: `POST /api/meetings/:id/complete`

5. **Post-Meeting Processing** (async)
   - Upload audio to Cloudinary
   - Generate AI summary (Groq)
   - Extract action items (Groq)
   - Generate embeddings (Gemini)
   - Store vectors (Qdrant)
   - Update database with results

---

## AI Processing Pipeline

### Input
- Meeting transcript (all lines)
- Meeting metadata (title, date, attendees)

### Steps
1. **Text Preparation**
   - Combine transcript lines with timestamps
   - Format: `[HH:MM:SS] Speaker: Text`

2. **LLM Analysis (Groq)**
   - Prompt: Analyze transcript
   - Output: Summary, key points, decisions, risks

3. **Action Item Extraction (Groq)**
   - Prompt: Extract todos with assignees
   - Output: Structured action items + priorities

4. **Embedding Generation (Gemini)**
   - Meeting summary → 768-dim vector
   - Each transcript line → 768-dim vector

5. **Vector Storage (Qdrant)**
   - Store in separate collections
   - Indexed for semantic search

6. **Database Update**
   - Save AI summary + decisions
   - Create action items
   - Link vector embeddings

---

## Semantic Search

### Meeting Search
```typescript
// Find similar past meetings
const results = await searchSimilarMeetings(
  queryEmbedding,
  userId,
  limit: 5
);
```

### Transcript Search
```typescript
// Find relevant moments in transcripts
const results = await searchTranscripts(
  queryEmbedding,
  meetingId, // optional
  limit: 10
);
```

---

## Security

### Authentication
- OAuth 2.0 with Google
- JWT tokens (7-day expiry)
- HttpOnly cookies for sessions
- CORS configured for frontend origin

### Data Isolation
- User-scoped database queries
- Auth middleware on all protected routes
- Qdrant filters by `userId`

### API Keys
- All secrets in environment variables
- Never committed to git
- Separate keys per environment

---

## Future Phases

### Phase 5: Integrations (Planned)
- Slack bot for summary delivery
- Email reports via SendGrid
- Google Calendar sync via MCP
- Export to PDF/Markdown/DOCX

### Phase 6: Pre-Meeting Intelligence (Planned)
- Attendee enrichment (LinkedIn, web)
- Past meeting context retrieval
- Suggested talking points
- Open action item reminders

---

## Troubleshooting

### Deepgram Connection Issues
- Check `DEEPGRAM_API_KEY` is set
- Verify network allows WebSocket
- Test with: `curl -H "Authorization: Token $DEEPGRAM_API_KEY" https://api.deepgram.com/v1/projects`

### Qdrant Not Connecting
- Ensure Qdrant is running: `docker ps | grep qdrant`
- Check `QDRANT_URL` matches container/cloud URL
- Verify collections created: collections will auto-create on first use

### Database Migration Errors
- Reset: `pnpm db:push --force-reset`
- Check connection string in `DATABASE_URL`
- Ensure PostgreSQL is running

### Audio Recording Silent
- Check microphone permission granted (macOS System Settings)
- Verify correct audio source selected
- Test microphone in system: `rec test.wav` (macOS)

---

## Performance Notes

- **Transcript processing:** Batched in chunks of 10 lines
- **Embedding generation:** ~100ms per call (Gemini)
- **LLM inference:** ~2-5s for summary (Groq)
- **Vector search:** <100ms (Qdrant)
- **Audio upload:** Depends on file size + network

---

## File Structure

```
ai-meeting-assistant-app/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   ├── seed.ts             # Sample data
│   │   └── migrations/         # Migration files
│   ├── src/
│   │   ├── lib/
│   │   │   ├── prisma.ts       # DB client
│   │   │   ├── passport.ts     # Auth strategies
│   │   │   └── jwt.ts          # Token utils
│   │   ├── middleware/
│   │   │   └── auth.ts         # Auth middleware
│   │   ├── routes/
│   │   │   ├── auth.ts         # Auth endpoints
│   │   │   └── meetings.ts     # Meeting CRUD + AI
│   │   ├── services/
│   │   │   ├── ai.ts           # LangChain + Groq
│   │   │   ├── embeddings.ts   # Gemini embeddings
│   │   │   ├── vector-store.ts # Qdrant client
│   │   │   ├── meeting.ts      # Meeting CRUD
│   │   │   ├── cloudinary.ts   # File storage
│   │   │   └── processing.ts   # Post-meeting pipeline
│   │   └── server.ts           # Express app
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── electron/
│   │   ├── main.cjs            # Electron main process
│   │   ├── preload.cjs         # IPC bridge
│   │   ├── permissions.cjs     # macOS permissions
│   │   └── audio-recording-service.cjs  # Deepgram integration
│   ├── src/
│   │   ├── components/
│   │   │   ├── protected-route.tsx
│   │   │   └── user-profile.tsx
│   │   ├── contexts/
│   │   │   └── auth-context.tsx
│   │   ├── features/
│   │   │   ├── auth/            # Login screens
│   │   │   └── meeting-copilot/ # Main app
│   │   ├── lib/
│   │   │   └── api-client.ts    # Auth-aware fetch
│   │   └── app.tsx              # Router + providers
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── README.md                # This file
│   ├── completed.md
│   ├── in-progress.md
│   └── todo.md
│
├── .env.example                 # Root env template
└── README.md
```

---

## Credits

Built with modern AI tools:
- **LangChain** - LLM orchestration
- **Groq** - Ultra-fast LLM inference
- **Deepgram** - Real-time transcription
- **Google Gemini** - High-quality embeddings
- **Qdrant** - Vector similarity search
- **Prisma** - Type-safe database access

---

**Last Updated:** May 27, 2026
**Version:** 1.0.0-beta
**Status:** Ready for testing with API keys
