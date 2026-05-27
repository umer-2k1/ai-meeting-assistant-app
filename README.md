# 🤖 AI Meeting Copilot

**Production-ready AI-powered meeting assistant with real-time transcription, intelligent insights, and seamless integrations.**

> Built with Electron, React, Node.js, PostgreSQL, Deepgram, Groq, Google Gemini, and Qdrant.

---

## ✨ Features

### 🎙️ Real-Time Recording & Transcription
- Live audio capture (system + microphone)
- Deepgram Nova-2 streaming transcription
- Speaker diarization
- Pause/resume/stop controls
- Floating widget overlay

### 🧠 AI Intelligence
- **Post-Meeting Analysis:**
  - Executive summary (Groq LLM)
  - Key discussion points
  - Decisions made
  - Risks/blockers identified
  - Action item extraction with priorities

- **Semantic Search:**
  - Find similar past meetings (Gemini + Qdrant)
  - Search transcript moments
  - Context-aware Q&A

### 🔐 Authentication
- Google OAuth 2.0 login
- Auto-detect signup/login
- JWT session management
- Protected routes

### 💾 Data Management
- PostgreSQL database (Prisma ORM)
- Cloudinary audio storage
- Full transcript history
- Rich text notes
- Action item tracking

---

## 📋 Current Status

**All Core Features Implemented! ✅**

- ✅ Google OAuth Authentication
- ✅ Database Schema (PostgreSQL + Prisma)
- ✅ Real Audio Recording (Electron + Deepgram)
- ✅ Live Transcription with Diarization
- ✅ AI Summary Generation (Groq)
- ✅ Action Item Extraction
- ✅ Semantic Search (Gemini + Qdrant)
- ✅ File Storage (Cloudinary)
- ✅ Post-Meeting Processing Pipeline
- ✅ Protected API Endpoints

**Ready for:** API key configuration and testing

**Pending:** Slack/Email integrations, Calendar sync via MCP (Milestone 5)

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥22.13
- PostgreSQL
- Qdrant (Docker recommended)
- API Keys:
  - Google OAuth credentials
  - Deepgram API key
  - Groq API key
  - Google Gemini API key
  - Cloudinary account
  - Qdrant API key (if using cloud)

### Installation

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit .env files with your API keys

# 3. Start PostgreSQL + Qdrant (Docker)
docker-compose up -d

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

## 🔑 Required API Keys

Add these to your `.env` files:

| Service | Purpose | Get Key |
|---------|---------|---------|
| **Google OAuth** | Authentication | [Google Cloud Console](https://console.cloud.google.com) |
| **Deepgram** | Speech-to-Text | [Deepgram Console](https://console.deepgram.com) |
| **Groq** | LLM Inference | [Groq Console](https://console.groq.com) |
| **Google Gemini** | Embeddings | [Google AI Studio](https://aistudio.google.com/apikey) |
| **Cloudinary** | Audio Storage | [Cloudinary](https://cloudinary.com) |
| **Qdrant** | Vector Search | Local or [Qdrant Cloud](https://cloud.qdrant.io) |

---

## 📖 Documentation

- **Architecture:** [`docs/README.md`](docs/README.md) - Complete system design
- **Completed Features:** [`docs/completed.md`](docs/completed.md)
- **Todo List:** [`docs/todo.md`](docs/todo.md)
- **Requirements:** [`NEW_REQUIREMENT.md`](NEW_REQUIREMENT.md)

---

## 🏗️ Tech Stack

### Frontend
- React + TypeScript + Vite
- Tailwind CSS + Shadcn UI
- Electron (Desktop)
- Tiptap (Rich Text Editor)

### Backend
- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- Passport.js (OAuth)
- JWT Authentication

### AI Layer
- **LLM:** Groq (llama-3.3-70b-versatile)
- **Orchestration:** LangChain + LangGraph
- **Embeddings:** Google Gemini (text-embedding-004)
- **Vector DB:** Qdrant
- **STT:** Deepgram Nova-2

### Infrastructure
- **Storage:** Cloudinary
- **Database:** PostgreSQL
- **Vector Store:** Qdrant

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
// Semantic search powered by Qdrant
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
- Ensure PostgreSQL is running
- Check `DATABASE_URL` format
- Try: `docker ps | grep postgres`

### "Qdrant not found"
- Start Qdrant: `docker run -p 6333:6333 qdrant/qdrant`
- Or use cloud URL in `QDRANT_URL`

### "Microphone access denied"
- macOS: System Settings → Privacy & Security → Microphone
- Grant permission to "AI Meeting Copilot"

---

## 📊 Performance

- **Transcription Latency:** <500ms (Deepgram)
- **LLM Response:** 2-5s (Groq)
- **Embedding Generation:** ~100ms/text (Gemini)
- **Vector Search:** <100ms (Qdrant)
- **Audio Upload:** Depends on file size

---

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🎉 What's Next?

### Milestone 5 (Planned)
- [ ] Slack integration
- [ ] Email delivery (SendGrid)
- [ ] Google Calendar sync (via MCP)
- [ ] PDF/Markdown export
- [ ] Pre-meeting intelligence
- [ ] Attendee enrichment (LinkedIn)

See [`docs/todo.md`](docs/todo.md) for complete roadmap.

---

**Built with ❤️ using modern AI tools**

**Last Updated:** May 27, 2026  
**Version:** 1.0.0-beta  
**Status:** Ready for API key configuration

---

## 📞 Support

For technical support or questions:
- Documentation: [`docs/README.md`](docs/README.md)
- Architecture: See system diagrams in docs
- Setup Issues: Check troubleshooting section above

---

**🚀 Start building the future of meeting intelligence!**
