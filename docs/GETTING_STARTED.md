# Getting Started — Local Setup

A from-scratch guide to run the AI Meeting Copilot on your machine. It reflects
the current stack: **SQLite** (relational DB), **Qdrant** (vectors, via Docker),
and cloud APIs for AI / transcription / storage.

> The backend **fails fast**: it refuses to start until all required keys are
> present and prints exactly which ones are missing. This guide lists them.

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | **22.x** | `node -v` |
| pnpm | **10.x** | `npm i -g pnpm` |
| Docker | any recent | for Qdrant (`docker compose up -d`) |
| Git | any | |

Desktop app (optional) also needs the platform build tools Electron requires.
System-audio capture works on **macOS 14.2+** and **Windows**; elsewhere it falls
back to mic-only.

---

## 2. Clone & start Qdrant

```bash
git clone <your-fork-url> ai-meeting-assistant-app
cd ai-meeting-assistant-app

# Start the vector database (Qdrant) in the background.
docker compose up -d          # exposes Qdrant on http://localhost:6333
```

---

## 3. Get your API keys

Create accounts and copy the keys — you'll paste them into `backend/.env` next.

**Required (backend won't boot without these):**

| Key | Where to get it |
|-----|-----------------|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client (Web). Enable the **Google Calendar API** and **Gmail API**. |
| `GROQ_API_KEY` | https://console.groq.com — LLM (summaries, action items, chat) |
| `GOOGLE_GEMINI_API_KEY` | https://aistudio.google.com/apikey — embeddings (RAG) |
| `DEEPGRAM_API_KEY` | https://console.deepgram.com — live transcription |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | https://cloudinary.com — audio/export storage |
| `QDRANT_URL` | `http://localhost:6333` (from step 2) |
| `JWT_SECRET`, `SESSION_SECRET` | Any long random strings — `openssl rand -hex 32` |
| `DATABASE_URL` | Leave as `file:./dev.db` (SQLite) |

**Google OAuth redirect URIs** — in the same OAuth client, add BOTH (exact match,
no trailing slash):

- `http://localhost:3001/auth/google/callback`
- `http://localhost:3001/api/integrations/google/callback`

Add your Google account as a **test user** on the OAuth consent screen.

**Optional (features degrade cleanly if absent):**

| Key | Enables |
|-----|---------|
| `SLACK_BOT_TOKEN` | Sharing meeting reports to Slack channels |
| `SERPER_API_KEY` | Attendee web enrichment (LinkedIn/bio) in the pre-meeting brief |
| `QDRANT_API_KEY` | Only if your Qdrant requires auth (local Docker doesn't) |

---

## 4. Backend

```bash
cd backend
cp .env.example .env          # then fill in the keys from step 3
pnpm install

# Create the SQLite database + tables and seed a demo user/meeting.
pnpm db:migrate               # prisma migrate dev  (creates prisma/dev.db)
pnpm db:seed                  # optional demo data

pnpm dev                      # http://localhost:3001
```

You should see `🚀 ... running on http://localhost:3001` and a
`🎙️ Live transcription WS` line. Health check: http://localhost:3001/api/health.

If it exits with `❌ Cannot start: missing required environment variables`, add
the listed keys to `backend/.env` and re-run.

Useful backend scripts: `pnpm db:studio` (browse the DB), `pnpm db:migrate`,
`pnpm db:seed`, `pnpm build`.

---

## 5. Frontend (web)

In a second terminal:

```bash
cd frontend
cp .env.example .env          # VITE_BACKEND_URL=http://localhost:3001 is the default
pnpm install

pnpm dev                      # http://localhost:3000
```

Open http://localhost:3000, sign in with Google, and you're in.

---

## 6. Desktop app (optional, recommended for live transcription)

The desktop (Electron) build is where **system-audio capture** works — it records
all meeting participants, not just your mic.

```bash
cd frontend
pnpm desktop:dev              # starts Vite + launches Electron
```

On first run, grant **Microphone** and **System Audio Recording** permissions
(macOS: System Settings → Privacy & Security).

---

## 7. Try the golden path

1. **Connect Google Calendar** in Settings → Integrations (or the Calendar screen).
2. Open the **Calendar** tab → pick an event → **Prepare** for a pre-meeting brief.
3. **Start New Recording** → speak → watch the live transcript stream in.
4. **Stop** → the meeting is summarized (summary, decisions, action items).
5. On the meeting detail: **Ask AI** (RAG chat), **Export** Markdown/PDF, or
   **Share** by Email/Slack.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Backend won't start, lists missing vars | Fill them in `backend/.env`. |
| Search/AI chat works but returns no semantic hits | Ensure Qdrant is running: `docker compose ps`, `docker compose up -d`. Chat falls back to the full transcript if Qdrant is down. |
| Google sign-in hangs / redirect error | Confirm both redirect URIs are added to the OAuth client and your account is a test user. |
| Live transcript stays empty | System-audio capture needs the **desktop app** on macOS 14.2+/Windows; the web app is mic-only. Check mic permission under Device Check. |
| Email share returns "Connect Gmail" | Connect Gmail in Settings → Integrations first. |
| Slack share disabled | Set `SLACK_BOT_TOKEN` in `backend/.env` and restart. |
| Port already in use | Backend `PORT` (3001) or Vite `3000` — free the port or change it (and `VITE_BACKEND_URL`). |

---

## Ports & services summary

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:3000 |
| Backend (Express + WS) | http://localhost:3001 |
| Qdrant | http://localhost:6333 |
| SQLite DB | `backend/prisma/dev.db` |

For a deeper description of the architecture and what each phase implemented, see
[`docs/PRODUCTION_HARDENING_IMPLEMENTATION.md`](./PRODUCTION_HARDENING_IMPLEMENTATION.md).
