# Quick Reference - Files to Read

This guide helps developers/LLMs quickly locate essential files when starting new features or debugging.

---

## 🚀 Starting Point (Read First)

### Understanding the System
1. `docs/FINAL_STATUS.md` - Complete feature overview
2. `docs/IMPLEMENTATION_SUMMARY.md` - Recent changes
3. `NEW_REQUIREMENT.md` - Original requirements
4. `README.md` - Quick start guide

### Architecture & Tech Stack
1. `docs/README.md` - Complete architecture (468 lines)
2. `docs/PRODUCTION_ENHANCEMENTS.md` - New features (429 lines)

---

## 🔍 By Task Type

### 🆕 Adding New Features

**Backend:**
- `backend/src/server.ts` - Main server, middleware, routes
- `backend/src/lib/schemas.ts` - Zod validation schemas
- `backend/prisma/schema.prisma` - Database models
- `backend/src/services/` - Business logic (ai.ts, meeting.ts, etc.)
- `backend/src/routes/` - API endpoints (meetings.ts, live.ts, auth.ts)

**Frontend:**
- `frontend/src/app.tsx` - App structure, routing
- `frontend/src/lib/stores.ts` - Zustand state management
- `frontend/src/lib/hooks.ts` - Custom hooks (SSE, API)
- `frontend/src/features/` - Feature components

**Database:**
- `backend/prisma/schema.prisma` - Add models here
- `backend/prisma/seed.ts` - Seed data

### 🐛 Debugging Issues

**Recording Not Working:**
1. `frontend/electron/main.cjs` - Electron main process
2. `frontend/electron/audio-recording-service.cjs` - Audio capture + Deepgram
3. `frontend/electron/permissions.cjs` - macOS permissions
4. `frontend/.env` - Check `VITE_DEEPGRAM_API_KEY`

**Transcription Not Saving:**
1. `backend/src/routes/live.ts` - Live transcript endpoint
2. `backend/src/services/meeting.ts` - `addTranscriptLine()`
3. `backend/prisma/schema.prisma` - `TranscriptLine` model

**AI Chat Not Streaming:**
1. `backend/src/services/ai-stream.ts` - SSE streaming service
2. `backend/src/routes/live.ts` - `/ask` endpoint
3. `frontend/src/lib/hooks.ts` - `useStreamingChat()`
4. `frontend/src/lib/stores.ts` - `useAIChatStore`

**Authentication Issues:**
1. `backend/src/lib/passport.ts` - OAuth strategies
2. `backend/src/routes/auth.ts` - Auth endpoints
3. `frontend/src/contexts/auth-context.tsx` - Auth context
4. `frontend/src/lib/stores.ts` - `useAuthStore`

**Database Connection:**
1. `backend/.env` - Check `DATABASE_URL`
2. `backend/src/lib/prisma.ts` - Prisma client
3. `docker-compose.yml` - PostgreSQL config

**Vector Search Not Working:**
1. `backend/src/services/vector-store.ts` - Qdrant integration
2. `backend/src/services/embeddings.ts` - Gemini embeddings
3. `backend/.env` - Check `QDRANT_URL`, `GOOGLE_GEMINI_API_KEY`

### 🎨 UI/UX Changes

**Layout & Styling:**
- `frontend/src/features/meeting-copilot/meeting-copilot-app.tsx` - Main layout
- `frontend/src/features/meeting-copilot/meeting-detail/` - Detail screens
- `frontend/src/components/` - Shared components

**Loading States:**
- `frontend/src/components/loading-states.tsx` - All skeletons & indicators

**State Management:**
- `frontend/src/lib/stores.ts` - All Zustand stores

### 📅 Date/Time Issues
- `frontend/src/lib/date-utils.ts` - All date formatting functions
- Uses `date-fns` library

### ✅ Validation Issues
- `backend/src/lib/schemas.ts` - All Zod schemas
- `backend/src/middleware/validation.ts` - Validation middleware

---

## 📦 Configuration Files

### Environment Variables
- `.env.example` - Template
- `backend/.env.example` - Backend template
- `frontend/.env.example` - Frontend template

### Database
- `backend/prisma/schema.prisma` - Schema definition
- `backend/prisma/seed.ts` - Seed data
- `backend/package.json` - DB scripts (`db:push`, `db:seed`, etc.)

### Build & Deploy
- `frontend/package.json` - Frontend scripts
- `backend/package.json` - Backend scripts
- `docker-compose.yml` - Infrastructure

---

## 🔗 Key Integrations

### Deepgram (Speech-to-Text)
- `frontend/electron/audio-recording-service.cjs` - Live transcription
- `backend/.env` - `DEEPGRAM_API_KEY`

### Groq (LLM)
- `backend/src/services/ai.ts` - Standard AI functions
- `backend/src/services/ai-stream.ts` - Streaming responses
- `backend/.env` - `GROQ_API_KEY`

### Google Gemini (Embeddings)
- `backend/src/services/embeddings.ts` - Embedding generation
- `backend/.env` - `GOOGLE_GEMINI_API_KEY`

### Qdrant (Vector Store)
- `backend/src/services/vector-store.ts` - Vector operations
- `backend/.env` - `QDRANT_URL`

### Cloudinary (File Storage)
- `backend/src/services/cloudinary.ts` - Audio upload
- `backend/.env` - `CLOUDINARY_*` credentials

### Google OAuth
- `backend/src/lib/passport.ts` - OAuth strategies
- `backend/.env` - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

---

## 🛣️ API Endpoints Reference

### Authentication
- **Routes:** `backend/src/routes/auth.ts`
- **Middleware:** `backend/src/middleware/auth.ts`

### Meetings (Standard)
- **Routes:** `backend/src/routes/meetings.ts`
- **Service:** `backend/src/services/meeting.ts`

### Live Meetings (Real-Time)
- **Routes:** `backend/src/routes/live.ts`
- **Service:** `backend/src/services/ai-stream.ts`

---

## 📊 Data Flow

### Recording Flow
```
1. frontend/electron/main.cjs
   ↓ (IPC: start-recording)
2. frontend/electron/audio-recording-service.cjs
   ↓ (Deepgram WebSocket)
3. Deepgram API
   ↓ (IPC: transcript-update)
4. frontend renderer
   ↓ (API: POST /api/live/meetings/:id/transcript)
5. backend/src/routes/live.ts
   ↓
6. backend/src/services/meeting.ts → Database
   ↓ (background)
7. backend/src/services/embeddings.ts → Qdrant
```

### AI Chat Flow (SSE)
```
1. frontend (user types question)
   ↓ (API: POST /api/live/meetings/:id/ask?stream=true)
2. backend/src/routes/live.ts
   ↓
3. backend/src/services/embeddings.ts (generate query embedding)
   ↓
4. backend/src/services/vector-store.ts (search Qdrant)
   ↓
5. backend/src/services/ai-stream.ts (Groq streaming)
   ↓ (SSE events)
6. frontend/src/lib/hooks.ts (useStreamingChat)
   ↓
7. frontend/src/lib/stores.ts (useAIChatStore)
   ↓
8. UI updates token-by-token
```

---

## 🧪 Testing Files

### Setup
- `docs/INSTALLATION.md` - Installation guide
- `docs/VERIFICATION_CHECKLIST.md` - Feature verification

### Test Scripts
- `frontend/package.json` - Frontend test commands
- `frontend/__tests__/` - Test files

---

## 🚨 Common File Paths

### Most Modified Files (Hot Spots)
1. `backend/src/routes/live.ts` - Live meeting logic
2. `frontend/src/lib/stores.ts` - State management
3. `backend/src/services/ai-stream.ts` - AI streaming
4. `frontend/src/components/loading-states.tsx` - UI components

### Critical Files (Don't Break These)
1. `backend/prisma/schema.prisma` - Database schema
2. `backend/src/lib/passport.ts` - Authentication
3. `frontend/electron/main.cjs` - Electron main process
4. `backend/src/server.ts` - Server setup

---

## 📝 Quick Tips

### Adding a New API Endpoint
1. Create schema in `backend/src/lib/schemas.ts`
2. Add route in `backend/src/routes/*.ts`
3. Add validation middleware
4. Create service function in `backend/src/services/*.ts`
5. Update `backend/src/server.ts` if new router

### Adding a New UI Component
1. Create in `frontend/src/components/` or `frontend/src/features/`
2. Add to appropriate store in `frontend/src/lib/stores.ts` if stateful
3. Add loading state in `frontend/src/components/loading-states.tsx`

### Modifying Database Schema
1. Edit `backend/prisma/schema.prisma`
2. Run `pnpm db:push` (dev) or `pnpm db:migrate` (prod)
3. Update seed file if needed
4. Update Zod schemas in `backend/src/lib/schemas.ts`

### Adding a New State Store
1. Add to `frontend/src/lib/stores.ts`
2. Use DevTools to debug
3. Add persistence if needed (like `useAuthStore`)

---

## 📞 Need More Info?

- **Architecture**: Read `docs/README.md` (468 lines)
- **Recent Changes**: Read `docs/IMPLEMENTATION_SUMMARY.md`
- **Setup Issues**: Read `docs/INSTALLATION.md`
- **Testing**: Read `docs/VERIFICATION_CHECKLIST.md`
- **Features**: Read `docs/PRODUCTION_ENHANCEMENTS.md`

---

**Last Updated**: May 27, 2026  
**Version**: 1.1.0-production-ready

---

## 🎯 TL;DR - Most Important Files

**Top 10 Files to Understand:**
1. `docs/FINAL_STATUS.md` - What's implemented
2. `backend/src/server.ts` - Server setup
3. `backend/prisma/schema.prisma` - Database
4. `backend/src/routes/live.ts` - Live features
5. `frontend/src/lib/stores.ts` - State management
6. `frontend/src/app.tsx` - App structure
7. `frontend/electron/main.cjs` - Desktop app
8. `backend/src/services/ai-stream.ts` - AI streaming
9. `backend/src/lib/schemas.ts` - Validation
10. `frontend/src/lib/hooks.ts` - Custom hooks

**Start with these, and you'll understand 80% of the codebase!**
