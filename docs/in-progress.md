# In Progress

## Current Active Workstreams

- Milestone 2 (Desktop Foundation): Electron runtime implementation in progress.
- Wiring renderer to secure preload APIs for recording controls and state sync.
- Expanding frontend API-backed state beyond Ask AI (dashboard and transcript endpoints).
- Defining persistent database schema (meetings, transcript sentences, chunks, action items, notes).
- Hardening keyboard shortcuts and accessibility labels across all interactive controls.

## Immediate Next Integration

- Wire `GET /api/meetings` into dashboard data loading.
- Replace simulated web transcript loop with real transcript events from desktop recording service.
- Add resilience handling for desktop IPC disconnects and process restarts.
