# Installation & Setup Guide

## Prerequisites

Before you begin, ensure you have:
- **Node.js**: v20+ (recommended: v20.11.0+)
- **pnpm**: v10+ (recommended: v10.5.0+)
- **Docker**: For PostgreSQL and Qdrant
- **macOS/Windows/Linux**: Desktop app support

---

## Step 1: Clone Repository

```bash
git clone <your-repo-url>
cd ai-meeting-assistant-app
```

---

## Step 2: Install Dependencies

### Fix pnpm Store Location (if needed)
If you encounter `ERR_PNPM_UNEXPECTED_STORE`, run:

```bash
# Option 1: Reinstall dependencies (recommended)
rm -rf node_modules frontend/node_modules backend/node_modules
pnpm install

# Option 2: Set global store location
pnpm config set store-dir ~/.pnpm-store --global
pnpm install
```

### Install All Dependencies
```bash
# Root
pnpm install

# Frontend (includes Zustand, Zod, date-fns, Deepgram SDK)
cd frontend
pnpm install

# Backend (includes Zod, Prisma, LangChain, etc.)
cd ../backend
pnpm install
```

**✅ Verify Dependencies:**
- Frontend: `zustand`, `zod`, `date-fns` (already in package.json)
- Backend: `zod`, `@langchain/groq`, `@google/generative-ai`, `@qdrant/js-client-rest` (already in package.json)
- **Note**: `@deepgram/sdk` should be added to frontend if not already present

---

## Step 3: Configure Environment Variables

### Backend Configuration

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and add your actual API keys:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_meeting_copilot?schema=public"

# Google OAuth (Get from Google Cloud Console)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3001/auth/google/callback"

# JWT Secret (Generate with: openssl rand -base64 32)
JWT_SECRET="your-super-secret-jwt-key"
SESSION_SECRET="your-session-secret"

# AI Services
GROQ_API_KEY="gsk_..."                           # Get from console.groq.com
GOOGLE_GEMINI_API_KEY="AIzaSy..."                # Get from ai.google.dev
DEEPGRAM_API_KEY="..."                           # Get from deepgram.com

# Vector Store
QDRANT_URL="http://localhost:6333"               # Docker default
QDRANT_API_KEY=""                                # Optional for local

# File Storage
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Optional Integrations (Milestone 5)
SLACK_BOT_TOKEN=""
SENDGRID_API_KEY=""
SERPER_API_KEY=""
```

### Frontend Configuration

```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_DEEPGRAM_API_KEY=your-deepgram-api-key    # Same as backend
```

---

## Step 4: Start Infrastructure Services

### Start PostgreSQL + Qdrant

```bash
# From project root
docker-compose up -d

# Verify services are running
docker ps
# Should see: postgres (5432) and qdrant (6333)
```

---

## Step 5: Initialize Database

```bash
cd backend

# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed demo data (optional)
pnpm db:seed
```

**✅ Verify Database:**
```bash
pnpm db:studio
# Opens Prisma Studio at http://localhost:5555
# Check if tables exist: User, Meeting, TranscriptLine, etc.
```

---

## Step 6: Start Application

### Terminal 1: Backend
```bash
cd backend
pnpm dev
# Runs on http://localhost:3001
```

**✅ Verify Backend:**
- Open http://localhost:3001
- Should see: "AI Meeting Copilot API - Running"

### Terminal 2: Frontend (Web)
```bash
cd frontend
pnpm dev
# Runs on http://localhost:3000
```

**✅ Verify Frontend:**
- Open http://localhost:3000
- Should redirect to `/login`
- Click "Continue with Google" (OAuth flow)

### Terminal 3: Desktop App (Optional)
```bash
cd frontend
pnpm desktop:dev
# Launches Electron window
```

**✅ Verify Desktop:**
- Electron window opens
- Login screen appears
- Can access system audio permissions

---

## Step 7: Test Key Features

### 1. Authentication
- [ ] Click "Continue with Google"
- [ ] Google OAuth consent screen appears
- [ ] Redirects back to app
- [ ] Dashboard loads with user profile

### 2. Recording
- [ ] Grant microphone permission (macOS: System Settings)
- [ ] Click "Start Recording"
- [ ] Speak near microphone
- [ ] **NEW**: Live transcript appears in real-time
- [ ] Transcript saves to database (check Prisma Studio)

### 3. AI Chat (SSE Streaming)
- [ ] During recording, type question: "What did we discuss?"
- [ ] **NEW**: Response streams token-by-token
- [ ] Full answer saved to chat history
- [ ] Works after meeting ends too

### 4. Post-Meeting Processing
- [ ] Stop recording
- [ ] Status changes to "PROCESSING"
- [ ] AI generates summary + action items
- [ ] Status changes to "COMPLETED"
- [ ] Audio file uploaded to Cloudinary

### 5. Semantic Search
- [ ] Create 2-3 meetings
- [ ] Click "Search meetings" (future UI)
- [ ] Ask: "Meetings about budget"
- [ ] Relevant meetings returned

---

## Troubleshooting

### Issue: `ERR_PNPM_UNEXPECTED_STORE`
**Solution:** Reinstall dependencies (see Step 2)

### Issue: Database connection failed
**Solution:**
```bash
# Check if PostgreSQL is running
docker ps

# Restart containers
docker-compose restart

# Check DATABASE_URL in backend/.env
```

### Issue: Deepgram transcription not working
**Solution:**
1. Verify `DEEPGRAM_API_KEY` in `backend/.env`
2. Check Electron console for errors
3. Verify microphone permissions (macOS: System Settings > Privacy > Microphone)

### Issue: OAuth redirect error
**Solution:**
1. Verify Google OAuth credentials in Google Cloud Console
2. Add to Authorized redirect URIs:
   - `http://localhost:3001/auth/google/callback`
   - `http://localhost:3000/auth/callback`

### Issue: Qdrant connection failed
**Solution:**
```bash
# Check if Qdrant is running
curl http://localhost:6333/health

# Restart Qdrant
docker-compose restart qdrant
```

### Issue: Cloudinary upload fails
**Solution:**
1. Verify Cloudinary credentials in `backend/.env`
2. Check Cloudinary dashboard for quota limits

---

## Development Tips

### Hot Reload
- **Backend**: Uses `tsx watch` - auto-reloads on file changes
- **Frontend**: Uses Vite - instant HMR
- **Electron**: Requires manual restart

### Database Migrations
```bash
# Create new migration
pnpm db:migrate

# Reset database (⚠️ deletes all data)
prisma migrate reset
pnpm db:seed
```

### View Logs
```bash
# Backend logs
cd backend && pnpm dev
# Watch console for API requests, AI responses, etc.

# Frontend logs
# Open browser console (F12)

# Electron logs
# Open Electron DevTools (View > Toggle Developer Tools)
```

### Debugging AI Services

**Groq LLM:**
```bash
# Test Groq API directly
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"
```

**Qdrant:**
```bash
# Access Qdrant dashboard
open http://localhost:6333/dashboard
```

**Prisma Studio:**
```bash
cd backend && pnpm db:studio
```

---

## Production Deployment

### Environment Variables
- **Never commit** `.env` files
- Use environment-specific configs:
  - `.env.development`
  - `.env.production`

### Database
- Use managed PostgreSQL (e.g., Supabase, AWS RDS)
- Update `DATABASE_URL` in production `.env`

### Vector Store
- Use Qdrant Cloud or self-hosted cluster
- Update `QDRANT_URL` in production `.env`

### Build Frontend
```bash
cd frontend
pnpm build
# Output: dist/
```

### Build Backend
```bash
cd backend
pnpm build
# Output: dist/
```

### Docker Deployment (Optional)
```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Run in production
docker-compose -f docker-compose.prod.yml up -d
```

---

## Next Steps

1. **Configure API Keys** (Step 3)
2. **Test Recording Flow** (Step 7.2)
3. **Test SSE Streaming** (Step 7.3)
4. **Explore Production Features**:
   - Read [`docs/PRODUCTION_ENHANCEMENTS.md`](./docs/PRODUCTION_ENHANCEMENTS.md)
   - Read [`docs/FINAL_STATUS.md`](./docs/FINAL_STATUS.md)

---

## Support

- **Quick Start**: [`docs/FINAL_STATUS.md`](./docs/FINAL_STATUS.md)
- **Architecture**: [`docs/README.md`](./docs/README.md)
- **Production Features**: [`docs/PRODUCTION_ENHANCEMENTS.md`](./docs/PRODUCTION_ENHANCEMENTS.md)
- **GitHub Issues**: Report bugs or feature requests

---

**Status**: ✅ Production-ready system with real-time features

**Last Updated**: May 27, 2026

---

## Quick Command Reference

```bash
# Start everything
docker-compose up -d              # Infrastructure
cd backend && pnpm dev            # Backend
cd frontend && pnpm dev           # Frontend
cd frontend && pnpm desktop:dev   # Electron

# Database
pnpm db:push                      # Push schema
pnpm db:studio                    # Open Prisma Studio
pnpm db:seed                      # Seed demo data

# Build
cd frontend && pnpm build
cd backend && pnpm build

# Clean
rm -rf node_modules */node_modules
pnpm install
```

---

**🚀 You're ready to start building!**
