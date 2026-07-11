# Production Hardening — Implementation Details

This document records the work done to turn the AI Meeting Intelligence app from a
half-mock prototype into a functional, launch-oriented product, per
`NEW_REQUIREMENT.md`. It is organized by the phases that were executed.

> **Stack after this work:** SQLite (Prisma) · Express 5 + `ws` (WebSocket) ·
> Groq `llama-3.3-70b-versatile` (LangChain) · Deepgram `nova-2` live STT ·
> Gemini `text-embedding-004` + Qdrant (RAG) · Cloudinary · Gmail + Slack sharing.
> Backend **fails fast** if required keys are missing.

---

## Phase 0 — Foundations: SQLite, config, de-mock

**Database (Postgres → SQLite).** `backend/prisma/schema.prisma` now uses
`provider = "sqlite"`. SQLite/Prisma limitations were handled as follows:

- Scalar lists (`String[]`) → JSON-encoded `String` columns (`keyDecisions`,
  `risks`, `highlights`, `Integration.scopes`). Access via
  `backend/src/lib/json-list.ts` (`parseStringList` / `serializeStringList`).
- Native `enum`s → `String` columns. Union types live in
  `backend/src/lib/enums.ts`, derived from the zod schemas in `lib/schemas.ts`
  (single source of truth). All `@prisma/client` enum imports were repointed.
- `@db.Text` attributes removed (SQLite `String` already maps to TEXT).
- Old Postgres migrations deleted; a fresh SQLite migration was generated.
  `DATABASE_URL="file:./dev.db"`; `dev.db` is git-ignored.
- Added fields: `Meeting.processingError`, `Meeting.status` value `FAILED`,
  `MeetingAttendee.enrichedAt`.

**Fail-fast config.** `backend/src/lib/validate-env.ts` checks required env vars
at boot and exits with a clear list if any are missing. The hardcoded
`SESSION_SECRET` fallback was removed.

**De-mock.** Deleted `backend/src/data.ts`, the `/api/meetings-legacy` and
sample-transcript endpoints, and the keyword-matching fallback in
`POST /api/ask-meeting` (now real Groq agent, auth-required). Frontend
`VITE_BACKEND_URL` mismatch fixed via a shared `frontend/src/lib/config.ts`
(`BACKEND_URL`, `WS_BASE_URL`, `TOKEN_KEY`).

## Phase 1 — Real meeting data (removed `mock-data.ts`)

**Backend endpoints** (`backend/src/routes/meetings.ts`,
`backend/src/services/meeting.ts`):
`GET /api/meetings/search?q=` (semantic + SQL fallback), `DELETE /api/meetings/:id`,
and Meeting Notes CRUD (`GET/POST /:id/notes`, `PATCH/DELETE /notes/:noteId`).
`serializeMeetingForApi` parses list fields back to arrays for all responses.

**Frontend.** New `meetings-api.ts` (typed client + adapter mapping the Prisma
shape → the UI `Meeting` type), `use-meetings-data.ts` (list/detail hooks).
Dashboard, detail, and the floating widget now use **real data** with loading /
empty / error states, computed stats, richer status badges, debounced search,
notes save, delete-with-confirm, re-analyze, and a processing/FAILED banner.
`mock-data.ts` deleted. Added `/meetings/:id` deep-link route.

## Phase 2 — Live transcription pipeline (Deepgram, desktop-first)

Audio is captured in the **renderer** (main process can't use MediaStream APIs).

- **Backend:** `server.ts` now uses `http.createServer` + a `ws`
  `WebSocketServer` handling upgrades on `/api/live/:meetingId/stream`.
  `backend/src/lib/ws-auth.ts` verifies the JWT (via `Sec-WebSocket-Protocol`
  subprotocol) **and meeting ownership**. `backend/src/services/live-transcription.ts`
  runs one Deepgram `nova-2` diarized live connection per socket; final
  transcripts are persisted, embedded, and broadcast (interims broadcast only).
- **Frontend:** `use-live-transcription.ts` acquires mic (+ system-audio
  loopback on desktop), mixes via one `AudioContext`, streams Opus chunks
  (`MediaRecorder`, 250 ms) over the WS, and renders finals + a live interim
  line. Start creates a real meeting; stop closes the WS and triggers processing.
- Removed the fake `setInterval` transcript and the dead Electron
  `audio-recording-service.cjs`.
- **Qdrant fix:** point IDs are now UUIDs (`crypto.randomUUID()`), stored on
  `embeddingId` / `VectorEmbedding.qdrantId`; meeting deletion is filter-based.
  Shared embed path: `backend/src/services/transcript-embedding.ts`.

## Phase 3 — Post-meeting intelligence (summary / actions / RAG / chat)

- **Robust LLM JSON** (`backend/src/lib/llm-json.ts`): Groq JSON mode + fence
  stripping + zod validation + one retry. Applied to summary, action-item, and
  brief generation — malformed output now surfaces a `FAILED` status instead of
  silently returning empty.
- **Streaming chat:** the Live and Detail "Ask AI" now call the authenticated
  SSE endpoint `POST /api/live/meetings/:id/ask`, which does RAG over the
  transcript (with a full-transcript fallback if Qdrant/Gemini is down) and
  streams tokens. The fabricated `buildFallbackAnswer` was removed.

## Phase 4 — Sharing & export

- **Export** (`backend/src/services/export.ts`): Markdown and PDF (`pdfkit`)
  reports; `GET /api/meetings/:id/export.md` and `export.pdf`. The stubbed
  export bar was replaced with real authenticated downloads.
- **Email** (`backend/src/services/share.ts`): `POST /api/meetings/:id/share/email`
  sends an HTML report via the user's connected **Gmail** connector; logs to
  `IntegrationLog`. Returns a friendly 400 if Gmail isn't connected.
- **Slack** (`backend/src/services/slack.ts`): app-level bot token. `GET
  /api/integrations/slack/channels`, `POST /api/meetings/:id/share/slack`.
  Status reports `connected` only when `SLACK_BOT_TOKEN` is set.
- **Frontend:** a combined `meeting-share-dialog.tsx` (Email + Slack tabs) on
  the detail screen.

## Phase 5 — Pre-meeting intelligence, enrichment, hardening

- **Pre-meeting brief** (`backend/src/services/intelligence.ts`,
  `routes/intelligence.ts`): `POST /api/intelligence/pre-meeting` aggregates past
  meetings with the same attendees, their open action items, an LLM briefing
  (`generatePreMeetingBrief`), and (optionally) enriched attendee profiles.
- **Attendee enrichment** (`backend/src/services/enrichment.ts`): Serper-based
  public lookup, gated behind `SERPER_API_KEY` (disabled cleanly when absent —
  no fabrication).
- **Frontend:** `pre-meeting-screen.tsx`, reachable via a **"Prepare"** button on
  each calendar event (raw attendee emails are preserved through the transform).
- **Calendar write scope:** Connect now requests `calendar.events` (read+write)
  so the MCP `create_meeting` tool works.
- **Hardening:** `helmet` security headers, `express-rate-limit` on `/api`
  (600 / 15 min), JSON body cap. Fail-fast env, ownership-checked WS auth, and
  removal of all fabricated data paths were done in earlier phases.

---

## Verification performed

All checks below were run against the real services configured in `backend/.env`.

- **Build/type:** `tsc --noEmit` clean (backend + frontend); `vite build` succeeds.
- **DB:** `prisma migrate dev` + `db:seed` succeed on SQLite; API round-trips
  `keyDecisions` as a JSON array.
- **Endpoints:** meetings list/detail/notes/search, export `.md`/`.pdf` (valid
  files), share email/slack (graceful degradation), pre-meeting brief (returns
  past meetings + open action items), helmet headers present.
- **WebSocket:** unauthenticated → 401, valid-token-but-unowned-meeting → 401,
  owner → connection OPEN and Deepgram emits `ready`.
- **AI:** real Groq summary (decisions/risks/key-points) + action items parsed;
  SSE chat streams a transcript-grounded answer.

## Known follow-ups (not blocking core functionality)

- Full audio→transcript E2E requires a browser MediaRecorder source (the server
  pipeline and Deepgram handshake are verified); exercise it in the desktop app.
- Encrypt stored OAuth tokens at rest.
- Wire structured request logging (`pino`/`pino-http` are installed).
- Automated test suite (unit + integration + Playwright E2E) and CI workflow.
- Optional: local-first vector store / file storage to drop the Qdrant + Cloudinary
  setup requirement for contributors.

## Environment variables

Required to boot (see `backend/.env.example`): `DATABASE_URL`, `JWT_SECRET`,
`SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GROQ_API_KEY`,
`GOOGLE_GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `QDRANT_URL`, `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
Optional: `SLACK_BOT_TOKEN` (Slack sharing), `SERPER_API_KEY` (enrichment),
`QDRANT_API_KEY`.
