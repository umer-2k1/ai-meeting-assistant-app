# Milestones

## Milestone 1 - Web Prototype Baseline

**Status:** Completed

Includes:

- React desktop-style product UI based on requirement screens
- Backend mock API scaffold
- Ask AI async endpoint integration with fallback behavior
- Documentation structure and progress tracking docs

## Milestone 2 - Desktop Foundation

**Status:** In Progress

Includes:

- Electron `main` process scaffold
- Secure `preload` bridge with explicit IPC APIs
- Renderer integration for recording controls via IPC
- Tray menu and global shortcut for recording flow
- Dev/run flow for desktop mode and first IPC integration test

## Milestone 3 - Real Recording + STT

**Status:** Pending

Includes:

- Native audio capture in Electron
- Deepgram live streaming with reconnect handling
- Transcript streaming and recording lifecycle persistence
- Runtime notifications for recording states

## Milestone 4 - Core Intelligence + Data Platform

**Status:** Pending

Includes:

- Prisma + PostgreSQL data model and migrations
- Transcript chunking and embedding pipeline
- Groq-powered summary, decisions, risks, and action extraction
- Post-meeting intelligence generation workflow

## Milestone 5 - Integrations, Export, and Release Hardening

**Status:** Pending

Includes:

- OAuth integrations (Slack, Gmail, Google Calendar)
- Summary delivery workflows and export generation
- End-to-end tests, accessibility hardening, observability
- Desktop packaging, signing, and release readiness
