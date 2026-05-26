# Project Scope and Requirement Coverage

## Implemented in this milestone

### Frontend (React + Vite + shadcn + Tailwind)

- Desktop-style application shell with:
  - Left navigation sidebar
  - Main content area
  - Contextual right-side intelligence panels where needed
- Dashboard screen:
  - Meeting search
  - Recent meeting cards
  - Tags, participant counts, decisions/action-item counters
  - Open meeting action
- Live recording screen:
  - Recording timer with pause/resume/stop controls
  - Live transcript panel with highlighted moments
  - Ask AI input and answer history
  - Live intelligence panel
- Meeting detail screen:
  - Header metadata + share/export/email/slack actions
  - Tabs: Summary, Transcript, Action Items, Notes, AI Chat
  - AI insights side panel
- Calendar screen:
  - Connected account status
  - Upcoming meetings + quick recording/reminder actions
- Settings screen:
  - General, Audio, AI, Integrations, Privacy tabs
  - Gmail, Slack, and Calendar integration cards
- Floating widget:
  - Always visible while recording
  - Ask AI, Pause, and Stop controls
- Keyboard shortcuts support:
  - Command/Ctrl + `N`, `K`, `/`, Shift + `A`, and `Space` for recording flow

### Backend (separate folder scaffold)

- Separate `backend` workspace created to satisfy frontend/backend separation.
- Starter Express API with mock endpoints:
  - health
  - meetings list
  - transcript by meeting
  - ask-meeting

## Requirement areas intentionally mocked for now

- Real audio capture and dual-track device handling
- Deepgram live streaming and diarization
- Groq/LangGraph real-time intelligence pipeline
- RAG vector search with pgvector + Prisma
- OAuth integrations for Gmail/Slack/Google Calendar
- Export generation (PDF/TXT/JSON/DOCX)
- Electron main/preload/renderer secure IPC bridge
