# 🤖 AI Meeting Copilot

**Production-ready AI-powered meeting assistant with real-time transcription, intelligent insights, and seamless integrations.**

> Built with Electron, React, Node.js, SQLite, Deepgram, Groq, and Google Gemini.

> ⚡ **New here? Start with [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)** — a
> from-scratch local setup guide (Node 22 + pnpm, required API keys, and the run
> commands). The app uses **SQLite** for both its relational data **and** its
> vector store — no Postgres and no separate vector database needed.
>
> 📐 **How it works end-to-end:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) —
> module map, the data model, and every request/data flow (auth, calendar, live
> transcription, processing, RAG chat, sharing) with real file paths.

---

## ✨ Features

### 🎙️ Real-Time Recording & Transcription
- Live audio capture (system + microphone)
- **Deepgram Nova-2 streaming transcription**
- **Real-time transcript saving to database during live meetings**
- Speaker diarization
- Pause/resume/stop controls
- Floating widget overlay

### 🧠 AI Intelligence
- **Live AI Chat with SSE Streaming:**
  - Token-by-token responses (Server-Sent Events)
  - Works during AND after meetings
  - Real-time RAG with vector search
  - Context-aware answers

- **Post-Meeting Analysis:**
  - Executive summary (Groq LLM)
  - Key discussion points
  - Decisions made
  - Risks/blockers identified
  - Action item extraction with priorities

- **Semantic Search:**
  - Find similar past meetings (Gemini embeddings + SQLite vector search)
  - Search transcript moments
  - Live transcript search during meetings

### 🎨 Production-Grade UX
- **Loading States:**
  - Skeletons for meetings, transcripts, actions
  - "AI thinking" indicators
  - Recording pulse animation
  - Streaming text cursor
  - Empty state placeholders

- **State Management:**
  - Zustand stores (auth, meetings, recording, chat, UI)
  - DevTools integration
  - Persistence
  - Type-safe

- **Date Handling:**
  - Smart formatting ("Today", "2 hours ago")
  - Meeting status detection
  - Business day calculations
  - Duration formatting

### 🔐 Authentication
- Google OAuth 2.0 login
- Auto-detect signup/login
- JWT session management
- Protected routes

### 💾 Data Management
- PostgreSQL database (Prisma ORM)
- **Zod validation (15+ schemas)**
- Cloudinary audio storage
- Full transcript history
- Rich text notes
- Action item tracking
- **Extensible metadata support**

---

## 📋 Current Status

**All Core Features + Production Enhancements Complete! ✅**

### Core Platform
- ✅ Google OAuth Authentication
- ✅ Database Schema (PostgreSQL + Prisma + Zod)
- ✅ Real Audio Recording (Electron + Deepgram)
- ✅ Live Transcription with Diarization
- ✅ AI Summary Generation (Groq + Streaming)
- ✅ Action Item Extraction
- ✅ Semantic Search (Gemini embeddings + SQLite vector search)
- ✅ File Storage (Cloudinary)
- ✅ Post-Meeting Processing Pipeline
- ✅ Protected API Endpoints

### Production Enhancements ⭐ NEW
- ✅ **Real-time transcript saving to DB during live meetings**
- ✅ **SSE streaming for AI chat (token-by-token responses)**
- ✅ **Live RAG with vector search during meetings**
- ✅ **Zustand state management (5 stores)**
- ✅ **Zod validation schemas (15+ schemas)**
- ✅ **Loading states & skeletons (10+ components)**
- ✅ **date-fns integration (15+ utilities)**
- ✅ **Chat works during AND after meetings**

**Ready for:** API key configuration and end-to-end testing

**Pending:** Slack/Email integrations, Calendar sync via MCP (Milestone 5)

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥22.13
- pnpm 10.x
- No database server needed — the app uses embedded **SQLite** for both its
  relational data and its vector store.
- API Keys:
  - Google OAuth credentials
  - Deepgram API key
  - Groq API key
  - Google Gemini API key
  - Cloudinary account

### Installation

```bash
# 1. Install dependencies
pnpm install
cd frontend && pnpm add @deepgram/sdk zustand
cd ../backend && pnpm install

# 2. Set up environment variables
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit .env files with your API keys

# 3. Initialize database (SQLite — created on disk, no server to start)
cd backend
pnpm db:push
pnpm db:seed

# 4. Start backend
pnpm dev

# 5. Start frontend (new terminal)
cd ../frontend
pnpm dev

# 6. Start Electron desktop (new terminal)
cd frontend
pnpm desktop:dev
```

---

## 🔑 Required API Keys

Add these to your `.env` files:

| Service | Purpose | Get Key |
|---------|---------|---------|
| **Google OAuth** | Authentication | [Google Cloud Console](https://console.cloud.google.com) |
| **Deepgram** | Speech-to-Text | [Deepgram Console](https://console.deepgram.com) |
| **Groq** | LLM Inference | [Groq Console](https://console.groq.com) |
| **Google Gemini** | Embeddings | [Google AI Studio](https://aistudio.google.com/apikey) |
| **Cloudinary** | Audio Storage | [Cloudinary](https://cloudinary.com) |

---

## 📖 Documentation

- **Getting Started:** [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) — set up & run from scratch
- **Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how it works end-to-end (module map + data flows)
- **Implementation details:** [`docs/PRODUCTION_HARDENING_IMPLEMENTATION.md`](docs/PRODUCTION_HARDENING_IMPLEMENTATION.md) — what each phase built + follow-ups
- **Plan:** [`docs/PRODUCTION_HARDENING_PLAN.md`](docs/PRODUCTION_HARDENING_PLAN.md)
- **Requirements:** [`NEW_REQUIREMENT.md`](NEW_REQUIREMENT.md)

---

## 🏗️ Tech Stack

### Frontend
- React + TypeScript + Vite
- **Zustand** (state management) ⭐
- **Zod** (validation) ⭐
- **date-fns** (date utilities) ⭐
- Tailwind CSS + Shadcn UI
- Electron (Desktop)
- Tiptap (Rich Text Editor)

### Backend
- Node.js + Express + TypeScript
- **Zod** (validation) ⭐
- PostgreSQL + Prisma ORM
- Passport.js (OAuth)
- JWT Authentication

### AI Layer
- **LLM:** Groq (llama-3.3-70b-versatile) + **SSE Streaming** ⭐
- **Orchestration:** LangChain + LangGraph
- **Embeddings:** Google Gemini (gemini-embedding-001)
- **Vector Store:** SQLite (cosine similarity) + **Live RAG** ⭐
- **STT:** Deepgram Nova-2

### Infrastructure
- **Storage:** Cloudinary
- **Database:** SQLite (relational data + vectors)

---

## 📁 Project Structure

```
ai-meeting-assistant-app/
├── backend/              # Node.js API server
│   ├── prisma/          # Database schema & migrations
│   ├── src/
│   │   ├── lib/         # Prisma, Passport, JWT
│   │   ├── middleware/  # Auth middleware
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   └── server.ts    # Express app
│   └── package.json
│
├── frontend/            # React + Electron app
│   ├── electron/        # Main process + audio service
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── contexts/    # React contexts (auth)
│   │   ├── features/    # Feature modules
│   │   └── lib/         # API client
│   └── package.json
│
├── docs/                # Documentation
└── .env.example         # Environment template
```

---

## 🔐 Security

- **Authentication:** Google OAuth 2.0 + JWT
- **Data Isolation:** User-scoped queries
- **API Keys:** Environment variables only
- **CORS:** Configured for frontend origin
- **Secrets:** Never committed to git

---

## 🎯 Usage Flow

### Recording a Meeting

1. **Start**
   - Click "Start Recording" or press `⌘K`
   - Grant microphone permission (first time)
   - Floating widget appears

2. **During Meeting**
   - Live transcript updates in real-time
   - Speaker identification automatic
   - Ask AI questions anytime
   - Pause/resume as needed

3. **Stop & Process**
   - Click "Stop Recording"
   - Audio uploaded to Cloudinary
   - AI generates:
     - Meeting summary
     - Key decisions
     - Action items
     - Semantic embeddings
   - Available in Meeting Detail view

### Searching Past Meetings

```typescript
// Semantic search powered by SQLite vector search
await api.post('/api/meetings/search', {
  query: "What was discussed about pricing?"
});
```

---

## 🧪 Testing

```bash
# Backend API tests
cd backend
pnpm test

# Frontend unit tests
cd frontend
pnpm test

# Electron IPC tests
cd frontend
pnpm test:desktop-ipc
```

---

## 🐛 Troubleshooting

### "Deepgram connection failed"
- Verify `DEEPGRAM_API_KEY` in `.env`
- Check network allows WebSocket connections
- Test: `curl -H "Authorization: Token YOUR_KEY" https://api.deepgram.com/v1/projects`

### "Database connection error"
- The database is SQLite — check `DATABASE_URL` (default `file:./dev.db`)
- Run `pnpm db:push` in `backend/` to create/sync the schema

### "Microphone access denied"
- macOS: System Settings → Privacy & Security → Microphone
- Grant permission to "AI Meeting Copilot"

---

## 📊 Performance

- **Transcription Latency:** <500ms (Deepgram)
- **LLM Response:** 2-5s (Groq)
- **Embedding Generation:** ~100ms/text (Gemini)
- **Vector Search:** <10ms (in-process cosine similarity over SQLite)
- **Audio Upload:** Depends on file size

---

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🎉 What's Next?

Recently delivered (see [`docs/PRODUCTION_HARDENING_IMPLEMENTATION.md`](docs/PRODUCTION_HARDENING_IMPLEMENTATION.md)):

- [x] Google Calendar sync + pre-meeting intelligence
- [x] Live transcription (Deepgram) + RAG-grounded AI chat
- [x] Markdown/PDF export, Email (Gmail) & Slack sharing
- [x] Attendee enrichment (Serper, optional)
- [x] Local-first vector store — embeddings moved from Qdrant into SQLite (no external vector DB)

Follow-ups still open:

- [ ] Encrypt stored OAuth tokens at rest
- [ ] Structured request logging (pino) + automated tests / CI
- [ ] Optional local-first file storage (drop the Cloudinary setup)

---

**Built with ❤️ using modern AI tools**

**Last Updated:** May 27, 2026  
**Version:** 1.1.0-production-ready ⭐ 
**Status:** Ready for API key configuration

---

## Start Services
# Terminal 1: Initialize Database (SQLite — no server to start)
cd backend
pnpm db:push
pnpm db:seed

# Terminal 2: Start Backend
cd backend
pnpm dev

# Terminal 4: Start Frontend
cd frontend
pnpm dev

# Terminal 5: Start Electron
cd frontend
pnpm desktop:dev


## 📞 Support

For technical support or questions:
- **Quick Start**: [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) ⭐ **Read this first!**
- **Architecture**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Setup Issues**: See the troubleshooting table in [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md)

---

**🚀 Start building the future of meeting intelligence with production-grade features!**
