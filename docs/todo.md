# TODO

## Sprint 1 - Connect Frontend and Backend

- [ ] Add backend API client module in frontend.
- [ ] Replace static dashboard data with `GET /api/meetings`.
- [ ] Connect Ask AI input to `POST /api/ask-meeting`.
- [ ] Add loading, success, and error states for API requests.
- [ ] Add basic integration tests for API contracts.

## Sprint 2 - Core Intelligence

- [ ] Add Prisma schema and initial migration.
- [ ] Persist meetings, transcripts, notes, and action items.
- [ ] Implement transcript chunking and embeddings.
- [ ] Integrate Groq summarization and action extraction.
- [ ] Add post-meeting generation pipeline trigger.

## Sprint 3 - Real-time Recording

- [ ] Implement Electron audio capture service.
- [ ] Stream audio to Deepgram and handle reconnect logic.
- [ ] Batch transcript updates and push via IPC/SSE.
- [ ] Add pause/resume/stop persistence in meeting sessions.
- [ ] Add recording-state notifications.

## Sprint 4 - Integrations and Export

- [ ] Implement OAuth for Slack, Gmail, and Google Calendar.
- [ ] Build summary delivery jobs (Slack + email).
- [ ] Build export generation for PDF/TXT/JSON/DOCX.
- [ ] Add "send to destination" workflows and confirmations.

## Sprint 5 - Hardening

- [ ] Add end-to-end tests for full meeting lifecycle.
- [ ] Add accessibility audit and keyboard-navigation tests.
- [ ] Add observability logs and service health dashboards.
- [ ] Prepare Electron package and signing pipeline.
