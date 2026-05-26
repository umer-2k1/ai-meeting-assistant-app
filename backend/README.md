# Backend (Scaffold)

This backend provides a starter API layer for the AI Meeting Copilot project.

## Endpoints

- `GET /api/health` - service health
- `GET /api/meetings` - sample meetings list
- `GET /api/meetings/:meetingId/transcript` - sample transcript lines
- `POST /api/ask-meeting` - mock meeting Q&A

## Run locally

```bash
pnpm install
pnpm dev
```

Default port: `4000`.

## Next integrations

- Replace in-memory mocks with PostgreSQL + Prisma models
- Add Deepgram streaming handlers
- Add Groq/LangGraph summary and action-item pipelines
- Add OAuth connectors for Gmail, Slack, and Google Calendar
