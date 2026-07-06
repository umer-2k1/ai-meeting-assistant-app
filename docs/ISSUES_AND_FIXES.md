# Issues & Fixes — AI Meeting Copilot

Audit of the app (backend, frontend, UI/UX) with the fix applied for each issue.
All changes landed on branch `feat/production-hardening` across 4 commits.

Severity: **Critical** = broken / security hole · **Major** = works partially or fails silently · **Minor** = polish.

---

## Phase 1 — Security & correctness (backend)
Commit `7a713378`

| # | Severity | Issue | File | Fix |
|---|----------|-------|------|-----|
| 1 | Critical | `POST /api/live/meetings/:id/transcript` (and the REST twin) let any authenticated user write transcript lines into any meeting — no ownership check. | `backend/src/routes/live.ts`, `backend/src/routes/meetings.ts` | Added `findOwnedMeeting()` gate before `addTranscriptLine`; returns 404 if not owned. |
| 2 | Critical | `POST /:id/complete` accepted a client `audioPath` and uploaded that local file to Cloudinary (arbitrary file read). | `backend/src/routes/meetings.ts`, `backend/src/services/meeting.ts` | Removed `audioPath` handling and the unused `updateMeetingAudio`/`uploadAndCleanup` path. |
| 3 | Major | `/complete` and the abandoned-session finalizer could both process the same meeting → duplicate summary/action items. | `backend/src/services/meeting.ts`, `backend/src/routes/meetings.ts` | `completeMeeting` now does an atomic `updateMany` guarded on `status:'LIVE'`; only the winning caller (`claimed`) triggers `processMeeting`. |
| 4 | Major | SSE `/ask` wrote raw errors and could write after `res.end()`, corrupting the stream; a DB failure swallowed the `done` frame. | `backend/src/routes/live.ts` | All errors sent as SSE `data:{error}` frames, guarded by `res.writableEnded`/`headersSent`; chat-persistence failure no longer blocks the `done` frame. |
| 5 | Critical (data) | Transcript embeddings recorded `dimension: 768` while the app generates 3072-dim Gemini vectors. | `backend/src/services/transcript-embedding.ts` | Use the shared `EMBEDDING_DIMENSION` constant (3072). |
| 6 | Major | Import background job could leave a meeting stuck in `PROCESSING` forever if the FAILED-status update also failed (silently swallowed). | `backend/src/routes/meetings.ts` | Log loudly on the status-update failure instead of `.catch(() => {})`. |
| 7 | Major | `FRONTEND_URL` / redirect URI fell back to localhost — OAuth silently breaks in production. | `backend/src/lib/validate-env.ts` | Require `FRONTEND_URL` and `GOOGLE_REDIRECT_URI` when `NODE_ENV=production`. |
| 8 | Major | Share-email endpoint never validated recipient addresses. | `backend/src/routes/meetings.ts`, `backend/src/lib/schemas.ts` | Validate each recipient with `z.string().email()`; 400 with the offending address. |

---

## Phase 2 — Broken / dead UX made functional
Commit `2423ca29`

| # | Severity | Issue | File | Fix |
|---|----------|-------|------|-----|
| 9 | Major | Live-recording title was hardcoded `defaultValue='Product Sync Meeting'`, uncontrolled, never saved; widget showed the same hardcoded string. | `frontend/src/features/meeting-copilot/meeting-copilot-app.tsx`, `meetings-api.ts` | New `PATCH /api/meetings/:id` + `updateMeetingTitleApi`; controlled input persisted on blur/Enter; widget bound to the real meeting title. |
| 10 | Major | A dropped chat SSE stream left partial text with no error marker. | `meeting-copilot-app.tsx`, `types.ts` | On error the answer is marked `error:true`, kept, and shows "Answer interrupted · Retry". |
| 11 | Major | Audio blob uploaded via a 600ms `setTimeout` guess — final chunk could be missing. | `use-live-transcription.ts`, `meeting-copilot-app.tsx` | `stop()` now resolves after the recorder's `stop` event (final chunk flushed) before uploading. |
| 12 | Major | Share dialog offered Slack/Email even when unconfigured; errored only after submit. | `meeting-detail/meeting-share-dialog.tsx` | Fetch integration status on open; disable Email with a "Connect Gmail in Settings" hint. |
| 13 | Major | Dead placeholder UI: "Report issue" (no handler), "Manage Speakers" ("future release" toast), favorite star (never persisted), "Add tag", "Highlight"/"Note" (no handlers). | `meeting-detail/meeting-detail-screen.tsx`, `meeting-copilot-app.tsx` | Removed all of them (no backend support; misleading). |
| 14 | Minor | Electron widget reset to bottom-right every session; position not saved. | `frontend/electron/main.cjs` | Persist position/size to `userData/widget-prefs.json`, restore on launch, clamp to a visible display. |

---

## Phase 3 — Resilience
Commit `49c904bf`

| # | Severity | Issue | File | Fix |
|---|----------|-------|------|-----|
| 15 | Major | A transient Deepgram drop killed the live session with no recovery. | `backend/src/services/live-transcription.ts` | Bounded reconnect (3 tries, doubling backoff); buffers audio during the gap; replays the WebM init chunk so a fresh connection can decode; clear client error on permanent loss. |
| 16 | Minor | Detail view polled every 2s while processing (no backoff); calendar "Sync now" had no debounce. | `meeting-copilot-app.tsx`, `calendar-screen.tsx` | Poll backs off 3s→10s; sync has an in-flight guard + spinner/disabled state. |
| 17 | Minor | Raw `fetch` calls to external APIs had no timeout — a hung API blocks the request. | `services/slack.ts`, `services/enrichment.ts`, `connectors/google/oauth.ts` | Added `AbortSignal.timeout` (Slack 15s, Serper 10s, Google userinfo 10s). |
| 18 | Major | Vector-indexing failure degraded RAG silently (no user signal). | `backend/src/services/processing.ts`, `meeting-detail-screen.tsx` | On indexing failure, persist a `processingError` warning; detail screen shows an amber "Ask AI uses the full transcript" notice on completed meetings. |
| 19 | Minor | Search debounce used a raw `setTimeout` prone to leaking timers. | `meeting-copilot-app.tsx` | Debounce lives in a `useEffect` with proper cleanup. |

---

## Phase 4 — UI polish & cleanup
Commit `27bad91e`

| # | Severity | Issue | File | Fix |
|---|----------|-------|------|-----|
| 20 | Minor | Hardcoded hex colors (`bg-[#EF4444]`, `bg-[#06B6D4]`, `text-[#F59E0B]`, etc.) bypassed the theme; dark card gradient was an inline arbitrary value. | `meeting-copilot-app.tsx`, `copilot-styles.ts`, `copilot-theme.css`, `widget/floating-system-widget.tsx` | Replaced with theme/palette classes; moved the dark gradient into `--copilot-surface-gradient`. |
| 21 | Minor | Fixed `max-h-[420px]`/`max-h-[460px]` scroll areas overflowed on short windows; widget `w-80` could clip. | `meeting-copilot-app.tsx` | Viewport-relative caps (`50dvh`/`60dvh`); widget `max-w-[calc(100vw-2rem)]`. |
| 22 | Minor | Ask-AI submit button (icon-only) had no accessible label. | `meeting-copilot-app.tsx` | Added `aria-label="Ask AI"`. |
| 23 | Minor | Sidebar skeleton used `Math.random()` width → shifts on every repaint. | (assessed) | Left as-is (self-contained, negligible); noted. |
| 24 | Minor | Dead code: unused legacy `POST /api/meetings/:id/ask`, `uploadAndCleanup`, unreferenced `lib/stores.ts` + `lib/hooks.ts`; unwired delete-note endpoint. | backend routes/services, `frontend/src/lib/*` | Removed dead code; wired "Delete note" to the existing `DELETE /api/meetings/notes/:id`. |

---

## Verified false (audit claims not acted on)
- `FAILED` meeting status **is** mapped and rendered (`meetings-api.ts:89`, `STATUS_BADGE`, detail screen).
- Qdrant collections **already** use 3072 dimensions (`vector-store.ts`) — only the DB metadata row was wrong (fix #5).
- The desktop widget **already** had aria-labels on its icon buttons.

## Out of scope (documented, not built)
Native Electron system-audio capture (renderer `getUserMedia` path is intentional), meeting-list pagination, OAuth token encryption at rest, MCP calendar layer (direct Google works), structured logging, automated test suite. Repo also has ~2,700 pre-existing ESLint/Prettier errors (style debt) — flagged as a separate auto-fix task.

---

## Verification performed
- Backend + frontend typecheck and build clean.
- Runtime (real backend): cross-user transcript write → 404; cross-user rename → 404; own rename → 200; invalid share email → 400; empty title → 400; `/complete` on a completed meeting → `processing:false` (no re-run).
- Browser: login, dashboard (real data), cleaned detail screen, live idle state — all render with zero console errors.
