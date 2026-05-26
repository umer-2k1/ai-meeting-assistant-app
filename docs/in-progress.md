# In Progress

## Current Active Workstreams

- Converting frontend mock flows to API-backed state from the new backend endpoints.
- Defining persistent database schema (meetings, transcript sentences, chunks, action items, notes).
- Preparing Electron runtime split (main/preload/renderer) and secure IPC contracts.
- Hardening keyboard shortcuts and accessibility labels across all interactive controls.

## Immediate Next Integration

- Wire `GET /api/meetings` into dashboard data loading.
- Wire `POST /api/ask-meeting` into Ask AI panel for answer generation.
- Replace simulated transcript append loop with streamed backend events.
