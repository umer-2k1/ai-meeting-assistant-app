# Production Hardening: AI Meeting Intelligence App

## Status: All 6 phases implemented ✅ (Phases 0–5)

Backend + frontend typecheck clean; frontend `vite build` succeeds; backend boots
on SQLite with fail-fast env; live-transcription WS auth + Deepgram handshake,
RAG-grounded SSE chat, real Groq summary/actions, markdown/PDF export, and
pre-meeting brief all verified end-to-end. See
`docs/PRODUCTION_HARDENING_IMPLEMENTATION.md` for details and known follow-ups
(token encryption at rest, structured request logging, automated tests/CI).

## Context

The repo (`ai-meeting-assistant-app`) implements the skeleton of an Otter/Meetily-style meeting assistant, but a full audit (backend, frontend, AI/integration layers) shows it is **half-real, half-mock**:

**Genuinely real & wired:** Google OAuth login (passport + JWT), Google Calendar sync end-to-end (`calendar-screen.tsx` → `/api/integrations/calendar/events` → Google), Gmail send/draft + MCP tools, Groq LLM (`llama-3.3-70b-versatile`) for summary/action-items/chat/agentic tools, Gemini embeddings + Qdrant RAG (backend only), Cloudinary audio upload (orphaned), and real mic/system-audio device-test capture.

**Mock, stubbed, or missing:**
- **Live transcription does not exist.** Deepgram is a dependency but has zero code; the "live transcript" is a browser `setInterval` (`createRealtimeLine`, `meeting-copilot-app.tsx`). Desktop audio capture (`electron/audio-recording-service.cjs`) is dead/no-op. No WebSocket layer anywhere.
- **Dashboard / Live / Detail screens run entirely on `mock-data.ts`** — never call `/api/meetings`. The `useMeetings`/`useLiveTranscript` hooks and the whole zustand store layer exist but are **unused dead code** (app uses Context + local `useState`).
- **Slack** — not implemented (connector throws, status hardcoded `false`). **Email report flow** — missing (raw Gmail send exists but nothing composes/sends a report). **Markdown/PDF export** — stub toasts only. **Attendee enrichment / pre-meeting intelligence screen** — missing (`generatePreMeetingBrief` exists but is never called; enrichment fields never populated). **Historical semantic search** — backend code exists, no UI.

**Defects to fix:** Prisma is **PostgreSQL** using SQLite-incompatible features (`String[]` scalar lists, `@db.Text`, native `enum`s) — must move to **SQLite** per the open-source directive. Qdrant point IDs use cuids but Qdrant requires UUID/int (RAG upserts fail at runtime). `VITE_BACKEND_URL` default mismatch (`:4000` in `meeting-copilot/api.ts` vs `:3001` everywhere). Calendar connect scope is read-only but `create_meeting` needs write. Mock keyword-matching fallback lives in the production `POST /api/ask-meeting` path. Plaintext token storage; no rate-limit/helmet; fragile LLM-JSON parsing.

**Goal:** a cohesive, launch-ready product where every `NEW_REQUIREMENT.md` feature works for real, end-to-end.

## Architecture decisions (confirmed with user)

1. **Live capture: Desktop-first (Electron).** Renderer captures mixed mic + system-audio loopback → streams to backend over WebSocket → Deepgram live streaming → transcript persisted + pushed back. Web = mic-only fallback on the same pipeline.
2. **Keep Qdrant (Docker) + Cloudinary** as-is for now (only the **relational DB** moves to SQLite). Abstract lightly so they can be swapped later, but no local re-implementation this pass.
3. **Require keys to boot.** Backend fails fast at startup with a clear message listing any missing required env vars (`DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `GROQ_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `QDRANT_URL`, `CLOUDINARY_*`, `GOOGLE_CLIENT_*`).
4. **Vertical-slice sequencing:** get one flow fully real (Calendar → real DB meetings → live transcription → summary/actions → share) before broadening.

---

## Phase 0 — Foundations: SQLite, config, de-mock

**SQLite conversion** (`backend/prisma/schema.prisma`):
- `datasource` provider `postgresql` → `sqlite`; `DATABASE_URL="file:./dev.db"` in `.env`/`.env.example`; add `dev.db` to `.gitignore`.
- Scalar lists → JSON-string columns: `Integration.scopes`, `Meeting.keyDecisions`, `Meeting.risks`, `Meeting.highlights` become `String @default("[]")`.
- Remove all `@db.Text` attributes (SQLite `String` already maps to TEXT).
- All five native enums (`IntegrationProvider`, `MeetingStatus`, `Priority`, `ActionStatus`, `IntegrationType`) → `String` with string-literal defaults (SQLite/Prisma has no enums).
- **Delete `backend/prisma/migrations/*` (incl. `migration_lock.toml`)** — the Postgres DDL can't run on SQLite — then `prisma migrate dev --name init` regenerates a fresh SQLite migration; `prisma generate`; `db:seed`.

**Supporting code changes** (Prisma will stop exporting enum types & list arrays):
- New `backend/src/lib/json-list.ts` — `parseStringList` / `serializeStringList`.
- New `backend/src/lib/enums.ts` — union types (`type IntegrationProvider = 'GOOGLE_CALENDAR' | ...`) derived from the existing zod schemas in `lib/schemas.ts`; repoint imports in `connectors/connector-manager.ts`, `connectors/base-connector.ts`, `connectors/google/oauth.ts`.
- Serialize/parse `scopes` at write (`google/oauth.ts saveIntegration`) and read (`connector-manager.ts getConnector`).
- Serialize list fields on write in `services/processing.ts`; add `serializeMeetingForApi(meeting)` mapper in `services/meeting.ts` that parses the three list fields, and route all `GET /api/meetings` responses through it (`routes/meetings.ts`). `seed.ts` needs no change (already uses string literals, sets no list fields) — re-verify after enum switch.

**Fail-fast env guard** in `server.ts` startup (replace warn-only checks): validate required vars, print a clear list of what's missing, `process.exit(1)`. Remove the hardcoded `SESSION_SECRET` dev fallback.

**Remove production mock code:**
- Delete the keyword-matching fallback in `server.ts POST /api/ask-meeting` (~lines 220-270) and the `/api/meetings-legacy` + sample-data endpoints; delete `backend/src/data.ts` (`sampleMeetings`/`sampleTranscript`).
- Fix `VITE_BACKEND_URL` default to `:3001` in `frontend/src/features/meeting-copilot/api.ts`; centralize the base-URL helper so all clients agree.

**State/architecture decision:** standardize the frontend on **React Query-style data hooks over the existing `api-client.ts` + the zustand stores in `lib/stores.ts`** (they're already written for meetings/live/chat). Wire the unused `useMeetings`/`useLiveTranscript` hooks in `lib/hooks.ts` rather than leaving dead code; remove `axios` (unused — code uses `fetch`).

**Verify:** `prisma migrate dev` succeeds on SQLite; `db:seed` populates `dev.db`; backend boots only with all keys present and prints missing ones otherwise; `GET /api/meetings` returns arrays (not JSON strings) for a seeded user; `prisma studio` shows data.

## Phase 1 — Real meeting data wiring (kill `mock-data.ts`)

Wire the three mock screens to the real API. Add **per-meeting URL routing** (currently everything is one `/dashboard` route with internal `view` state):
- Routes: `/dashboard`, `/meetings/:id` (detail), `/live/:id` (live session), under `ProtectedRoute`.
- `DashboardScreen` → `GET /api/meetings` (real cards: title, start/end, attendees, duration, platform link, status badge). Replace hardcoded stat literals with computed counts. Loading skeletons (skeleton component exists) + empty state + error state.
- `MeetingDetailScreen` → `GET /api/meetings/:id` (summary, transcript, action items, notes, attendees, tags). Wire the currently-stubbed action buttons (Share/Email/Delete/Reprocess) to real endpoints (`POST /:id/reprocess` exists; Delete needs a new `DELETE /api/meetings/:id`). Wire **My Notes** tab to the unused `MeetingNote` model (new CRUD routes).
- Historical search: Dashboard search box → new `GET /api/meetings/search?q=` backed by Qdrant `searchSimilarMeetings` (already implemented in `vector-store.ts`) with a SQL title/summary fallback.
- Delete `mock-data.ts` and all imports once screens are wired.

**Verify:** create a meeting via API, see it on the dashboard; open detail; edit a note and reload (persists); search returns semantically-related past meetings.

## Phase 2 — Live transcription pipeline (Deepgram, desktop-first)

Full design validated. **Capture stays in the renderer** (main-process can't access MediaStream APIs).
- **Backend:** add `ws` + `@types/ws`. In `server.ts`, switch to `http.createServer(app)` + `WebSocketServer({noServer:true})`, handle `upgrade` for `^/api/live/([^/]+)/stream$`. New `backend/src/lib/ws-auth.ts` — verify JWT (via `Sec-WebSocket-Protocol` subprotocol, not query) + **authorize meeting ownership** + `Origin` check. New `backend/src/services/live-transcription.ts` — one Deepgram `listen.live({model:'nova-2', diarize:true, interim_results:true, punctuate:true, smart_format:true})` per socket; binary frames → `conn.send`; on final transcript persist a `TranscriptLine` (speaker = `"Speaker N"` from numeric diarization, `timestampSeconds` relative to `recordingStarted`), fire the shared embed helper, broadcast `{type:'transcript'}` back. `KeepAlive` on silence, `CloseStream` on stop.
- **Shared embed helper:** extract the background embed block from `routes/live.ts` POST-transcript into a reusable fn used by both the REST route and the WS path (uses the UUID Qdrant IDs from Phase 3 fix).
- **Frontend:** new `use-live-transcription.ts` hook — acquire mic (`use-microphone-test.ts` pattern) + desktop system audio (`use-system-audio-test.ts acquireViaDisplayMedia`), **mix into one stream via a single `AudioContext` + `MediaStreamDestination`**, one `MediaRecorder(mixed, {mimeType:'audio/webm;codecs=opus'}).start(250)`, ship chunks over WS, render finals appended + interims as one replaceable pending line. Delete `createRealtimeLine` + the fake `setInterval` in `meeting-copilot-app.tsx`.
- **Start/stop wiring:** Start → `POST /api/live/meetings` (real LIVE meeting) → open WS + capture. Stop → stop recorder, `CloseStream`/close WS, `POST /api/meetings/:id/complete` (triggers `processMeeting`) → navigate to detail. Keep `desktop.recording.*` for widget/timer/tray state only. Drop the dead `AudioRecordingService` import from `main.cjs`.
- **Pitfalls to respect:** webm/opus ⇒ do NOT set Deepgram `encoding`/`sample_rate`; one MediaRecorder ↔ one Deepgram socket (header only in first chunk); loopback is macOS 14.2+/Windows only (mic-only elsewhere, detect via `audioTrack.readyState==='ended'`); persist finals only; dedupe by `timestampSeconds` on reconnect.

**Verify:** start a live session on desktop, speak (or play audio) → real transcript lines appear within ~1s, labeled by speaker, and persist to `dev.db`; stopping triggers processing and lands on the detail view.

## Phase 3 — Post-meeting intelligence: summary, actions, RAG, chat

- **Fix the Qdrant cuid bug** (`vector-store.ts`, `processing.ts`, `routes/live.ts`): generate `crypto.randomUUID()` as the point id, keep the cuid in payload, persist the UUID to `TranscriptLine.embeddingId` / `Meeting.embeddingId` / `VectorEmbedding.qdrantId`; change `deleteMeetingEmbeddings` to delete-by-payload-filter. Without this, all RAG upserts silently fail.
- Verify `processMeeting` end-to-end: Groq summary + decisions/risks/highlights (now JSON-serialized) + action items (owners/deadlines) written; embeddings stored in Qdrant. Harden the fragile "JSON-from-LLM" parsing in `services/ai.ts` (schema-validate + retry, no silent empty fallback). Add a real error status path (currently failure silently marks `COMPLETED`) — add a `PROCESSING`→`FAILED` transition and surface it in the UI.
- **Live AI chat:** point the LiveScreen "Ask AI" and detail "AI Chat" tab at the real authenticated **SSE** endpoint `POST /api/live/meetings/:id/ask` (`credentials`/Bearer token included) with RAG context injection — replacing the client-side `buildFallbackAnswer` heuristic. Stream tokens into the UI.

**Verify:** after a live meeting, summary/decisions/risks/action-items render on the detail screen; "Summarize last 5 minutes" and "What was decided on X?" return grounded, streamed answers citing transcript context.

## Phase 4 — Sharing & export

- **Markdown export (real):** new `backend/src/services/export.ts` builds a markdown report (summary + transcript + action items + notes); `GET /api/meetings/:id/export.md` downloads it. **PDF** via a lightweight lib (e.g. `pdfkit`); optionally store to Cloudinary. Replace all stub toasts in `meeting-export-bar.tsx` with real downloads.
- **Email report (real):** new `POST /api/meetings/:id/share/email` composes the report and sends via the **existing Gmail connector** (`gmail.ts sendEmail`, already real) to selected attendees/custom recipients; log to `IntegrationLog`. Wire the detail "Email" button + a recipient-selection dialog to the already-existing-but-unused `sendEmail()` client.
- **Slack (new):** implement the `SLACK` branch in `connector-manager.ts` + a `SlackConnector` (Bot token from env), OAuth/connect route, `POST /api/meetings/:id/share/slack` posting a formatted summary + action items + highlights to a chosen channel; log to `IntegrationLog`. Replace the settings "coming soon" alert with a real connect flow + channel picker.

**Verify:** export a meeting to markdown & PDF (files open correctly); email a report to a test address (arrives via connected Gmail); post a summary to a Slack channel (message appears).

## Phase 5 — Pre-meeting intelligence, enrichment, historical memory, polish

- **Pre-meeting intelligence screen** (missing): new screen reachable from a calendar event / meeting detail. Backend endpoint aggregates: past meetings with the same attendees (Prisma + Qdrant `searchSimilarMeetings`), open action items & pending follow-ups from those meetings, and an agenda/briefing generated by the **existing-but-unused `generatePreMeetingBrief`** (`services/ai.ts`).
- **Attendee enrichment** (populate the never-filled `MeetingAttendee` fields): new `services/enrichment.ts` using `SERPER_API_KEY` (already in `.env.example`) for public LinkedIn/company/role lookup → store on the attendee → surface in the pre-meeting screen. Gate behind the key (feature disabled cleanly if absent).
- **Calendar write scope:** widen the connect scope so MCP `create_meeting` works (currently `calendar.readonly` only).
- **Polish pass across all screens:** consistent loading skeletons, empty states, error toasts/boundaries, disabled-when-unconfigured integration cards, animations (framer-motion already present), keyboard/focus/a11y, mobile responsiveness, and a design-token audit against `copilot-theme.css`.
- **Hardening:** `helmet`, rate limiting on API routes, request logging (pino), encrypt stored OAuth tokens at rest, retry/backoff on external API calls, and tests (see below).

**Verify:** open a calendar meeting → pre-meeting brief shows prior context, open action items, agenda, and (if key set) attendee bios; overdue-action reminders surface; every screen has proper loading/empty/error states.

---

## Cross-cutting verification

- **Automated:** backend unit tests for services (summary/action parsing, json-list, ws-auth, export) and integration tests for `/api/meetings`, `/api/live`, share endpoints; frontend Playwright E2E (already configured) for the golden path: login → dashboard → start live → transcript appears → stop → summary → share. Add a CI workflow running `typecheck` + `lint` + tests for both packages.
- **Manual golden path (desktop):** `docker compose up` (Qdrant) → seed → boot backend (keys present) → Electron app → Google login → Calendar connect → open meeting → pre-meeting brief → Start Meeting Intelligence → live transcript + live AI chat → Stop → summary/actions → export markdown/PDF → email + Slack share → confirm meeting is searchable in history.
- **Data integrity:** confirm Qdrant points use UUIDs and RAG returns hits; confirm list fields round-trip as arrays through the API; confirm no `mock-data.ts` / `buildFallbackAnswer` / sample-data code paths remain.

## Critical files (representative)

- **DB/config:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/*` (regenerate), `backend/prisma/seed.ts`, `backend/src/server.ts`, new `backend/src/lib/{json-list,enums,ws-auth}.ts`.
- **AI/RAG/live:** `backend/src/services/{vector-store,processing,ai,ai-stream,meeting}.ts`, new `backend/src/services/{live-transcription,export,enrichment}.ts`, `backend/src/routes/{live,meetings,integrations}.ts`.
- **Frontend:** `frontend/src/app.tsx` (routing), `frontend/src/features/meeting-copilot/{meeting-copilot-app,calendar-screen,settings-screen,api}.tsx/ts`, `frontend/src/features/meeting-copilot/meeting-detail/*`, new `use-live-transcription.ts`, `frontend/src/lib/{api-client,hooks,stores}.ts`, `frontend/electron/main.cjs`.
- **Delete:** `backend/src/data.ts`, `frontend/src/features/meeting-copilot/mock-data.ts`, `frontend/electron/audio-recording-service.cjs`, `backend/prisma/migrations/*` (Postgres).
