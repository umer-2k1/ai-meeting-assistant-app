# TODO

## Milestone 1 - Web Prototype Baseline (Completed)

- [x] Build requirement-aligned frontend screens and flows.
- [x] Add backend API scaffold with mock endpoints.
- [x] Connect Ask AI to backend endpoint with fallback behavior.
- [x] Establish docs and delivery tracking structure.

## Milestone 2 - Desktop Foundation (In Progress)

- [x] Add Electron main process scaffold.
- [x] Add secure preload bridge (`contextIsolation` + `nodeIntegration` disabled).
- [x] Add renderer IPC wiring for start/pause/stop recording and transcript events.
- [x] Add tray menu and global shortcut (`Cmd/Ctrl+K`) for recording control.
- [x] Add robust dual-process dev command (run Vite + Electron together).
- [ ] Add desktop-focused error banners and reconnect handling for IPC failures.
- [x] Add first integration test covering renderer -> preload -> main event flow.

## Milestone 3 - Real Recording + STT

- [ ] Implement Electron audio capture service.
- [ ] Stream audio to Deepgram and handle reconnect logic.
- [ ] Persist recording sessions and lifecycle state changes.
- [ ] Push transcript updates to renderer via IPC/SSE in stable batches.
- [ ] Add recording-state notifications.

## Milestone 4 - Core Intelligence + Data Platform

- [ ] Add Prisma schema and initial migration.
- [ ] Persist meetings, transcripts, notes, and action items.
- [ ] Implement transcript chunking and embeddings.
- [ ] Integrate Groq summarization and action extraction.
- [ ] Add post-meeting generation pipeline trigger.

## Milestone 5 - Integrations, Export, and Release Hardening

- [ ] Implement OAuth for Slack, Gmail, and Google Calendar.
- [ ] Build summary delivery jobs (Slack + email).
- [ ] Build export generation for PDF/TXT/JSON/DOCX.
- [ ] Add end-to-end tests for full meeting lifecycle.
- [ ] Add accessibility audit and keyboard-navigation tests.
- [ ] Add observability logs and service health dashboards.
- [ ] Prepare Electron package and signing pipeline.
