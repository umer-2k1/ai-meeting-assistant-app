# Quick Verification Checklist

Use this checklist to verify all production-grade features are working correctly.

---

## ✅ Core Infrastructure

### Database
- [ ] PostgreSQL running (Docker: `docker ps`)
- [ ] Prisma client generated (`pnpm db:generate`)
- [ ] Schema pushed (`pnpm db:push`)
- [ ] Seed data loaded (`pnpm db:seed`)
- [ ] Prisma Studio accessible (`pnpm db:studio` → http://localhost:5555)

### Vector Store
- [ ] Qdrant running (Docker: `docker ps`)
- [ ] Qdrant dashboard accessible (http://localhost:6333/dashboard)
- [ ] Collections created (check after first meeting processed)

### Backend
- [ ] Server running on http://localhost:3001
- [ ] `/` returns "AI Meeting Copilot API - Running"
- [ ] No startup errors in console

### Frontend
- [ ] Web app running on http://localhost:3000
- [ ] Redirects to `/login`
- [ ] No console errors

---

## ✅ Authentication

- [ ] "Continue with Google" button visible
- [ ] Google OAuth consent screen appears
- [ ] Successful redirect to `/auth/callback`
- [ ] Token + user saved to localStorage
- [ ] User profile displayed in header
- [ ] Dashboard loads with meetings list
- [ ] Logout works (clears token, redirects to login)

---

## ✅ Real-Time Recording

### Audio Capture
- [ ] macOS microphone permission granted
- [ ] "Start Recording" button appears
- [ ] Recording starts (status: "Recording...")
- [ ] Timer counts up
- [ ] Pause/Resume works
- [ ] Stop recording works

### Live Transcription
- [ ] **NEW**: Transcript appears in real-time during recording
- [ ] Speaker names detected (e.g., "Speaker 1", "Speaker 2")
- [ ] Timestamps accurate ("00:00:15", etc.)
- [ ] Confidence scores visible (optional)
- [ ] No lag or buffering

### Real-Time Database Saving
- [ ] **NEW**: Open Prisma Studio during recording
- [ ] Check `TranscriptLine` table
- [ ] Verify lines appear **during recording** (not just after)
- [ ] Each line has: speaker, text, timestamp, meetingId
- [ ] No duplicate lines

### Background Embedding Generation
- [ ] **NEW**: Check backend console during recording
- [ ] See log: "Background embedding generated for line ..."
- [ ] No errors in console
- [ ] Transcript lines continue streaming (non-blocking)

---

## ✅ AI Chat with SSE Streaming

### During Live Meeting
- [ ] Recording is active (status: "Recording...")
- [ ] Type question: "What did we discuss so far?"
- [ ] Click "Ask AI"
- [ ] **NEW**: See "AI is thinking..." indicator
- [ ] **NEW**: Response streams token-by-token (not all at once)
- [ ] Cursor animates during streaming
- [ ] Full answer appears progressively
- [ ] Answer saved to chat history

### After Meeting Ends
- [ ] Stop recording
- [ ] Wait for processing to complete (status: "COMPLETED")
- [ ] Type question: "What were the action items?"
- [ ] **NEW**: Response still streams token-by-token
- [ ] Uses full transcript + AI summary for context
- [ ] Chat history persists

### Network Verification
- [ ] Open browser DevTools → Network
- [ ] Filter by "ask"
- [ ] Request type: `POST /api/live/meetings/:id/ask`
- [ ] Response type: **`text/event-stream`** (SSE)
- [ ] See multiple `data:` events streaming in

---

## ✅ Live RAG with Vector Search

### During Recording
- [ ] Record at least 2 minutes of conversation
- [ ] Discuss multiple topics (e.g., budget, timeline, team)
- [ ] Ask AI: "What did we say about the budget?"
- [ ] **NEW**: Check backend console for:
   - "Generating query embedding..."
   - "Searching Qdrant for top 5 results..."
   - "Found X relevant snippets"
- [ ] AI answer references specific moments (timestamps)
- [ ] Answer is accurate and specific (not generic)

### After Meeting
- [ ] Create 2-3 meetings with different topics
- [ ] Ask: "Which meetings discussed marketing?"
- [ ] Relevant meetings returned (semantic search works)

---

## ✅ Zustand State Management

### Auth Store
- [ ] Open React DevTools → Components
- [ ] Find `AuthProvider` or component using `useAuthStore`
- [ ] Verify state: `{ user, token, isLoading }`
- [ ] Login → state updates immediately
- [ ] Logout → state clears
- [ ] Refresh page → state persists (localStorage)

### Meeting Store
- [ ] Inspect component using `useMeetingStore`
- [ ] Verify state: `{ meetings, currentMeeting, isLoading, error }`
- [ ] Fetch meetings → `isLoading: true` → `meetings` populated
- [ ] Select meeting → `currentMeeting` set

### Live Recording Store
- [ ] Inspect component using `useLiveRecordingStore`
- [ ] Verify state: `{ isRecording, isPaused, elapsedSeconds, liveTranscript }`
- [ ] Start recording → `isRecording: true`
- [ ] Transcript updates → `liveTranscript` array grows
- [ ] Stop recording → state resets

### AI Chat Store
- [ ] Inspect component using `useAIChatStore`
- [ ] Verify state: `{ messages, isAsking, streamingMessageId, currentAnswer }`
- [ ] Ask question → `isAsking: true`, `streamingMessageId` set
- [ ] Tokens arrive → `currentAnswer` appends
- [ ] Done → `isAsking: false`, message added to `messages`

---

## ✅ Zod Validation

### Backend API
- [ ] Send invalid meeting creation request:
  ```bash
  curl -X POST http://localhost:3001/api/meetings \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <token>" \
    -d '{ "title": "" }'
  ```
- [ ] Expect: `400 Bad Request`
- [ ] Response: `{ "error": "Validation failed", "details": [...] }`
- [ ] Details include: `"message": "Title is required"`

### Transcript Line Validation
- [ ] Send invalid transcript:
  ```bash
  curl -X POST http://localhost:3001/api/live/meetings/123/transcript \
    -H "Content-Type: application/json" \
    -d '{ "speaker": "", "text": "Test" }'
  ```
- [ ] Expect: `400 Bad Request`
- [ ] Error message: "Speaker is required"

### Frontend Validation (Optional)
- [ ] Try creating a meeting with empty title
- [ ] Form shows validation error (Zod + react-hook-form)

---

## ✅ Loading States & Skeletons

### Meeting List Loading
- [ ] Navigate to meetings list
- [ ] **Before data loads**: See `MeetingListSkeleton` (3 gray cards)
- [ ] **After data loads**: See actual meeting cards
- [ ] No flash of empty content

### Transcript Loading
- [ ] Open meeting detail
- [ ] Navigate to "Transcript" tab
- [ ] **Before data loads**: See `TranscriptSkeleton` (5 gray lines)
- [ ] **After data loads**: See actual transcript lines

### AI Thinking Indicator
- [ ] Ask AI a question
- [ ] **While waiting**: See animated dots + "AI is thinking..."
- [ ] **When streaming starts**: Indicator disappears
- [ ] Tokens appear progressively

### Recording Indicator
- [ ] Start recording
- [ ] See pulsing red dot + "Recording" badge
- [ ] Pause → dot changes to yellow "Paused"
- [ ] Stop → indicator disappears

### Processing Indicator
- [ ] Stop recording
- [ ] Status changes to "PROCESSING"
- [ ] See spinner + "Processing meeting..."
- [ ] After ~5-10s → "COMPLETED"

---

## ✅ date-fns Utilities

### Meeting Card Dates
- [ ] View meetings list
- [ ] Recent meeting (today): Shows "Today at 10:30 AM"
- [ ] Yesterday: Shows "Yesterday at 3:45 PM"
- [ ] Older: Shows "May 25, 2026"

### Meeting Status
- [ ] Upcoming meeting (future date): Badge says "Upcoming"
- [ ] Live meeting (started, no end time): Badge says "Live"
- [ ] Ended meeting: Badge says "Ended"

### Transcript Timestamps
- [ ] View transcript
- [ ] Timestamps formatted as "00:05:23" (HH:MM:SS)
- [ ] Clicking timestamp seeks audio player (future)

### Meeting Duration
- [ ] Completed meeting: Shows "1h 23m" or "45m"
- [ ] Live meeting: Shows elapsed time (counting up)

---

## ✅ Extensible Metadata

### Database Schema
- [ ] Open Prisma Studio
- [ ] Check `Meeting` table
- [ ] Verify columns exist: `keyDecisions`, `risks`, `highlights` (arrays)
- [ ] Relations: `transcript`, `actionItems`, `attendees`, `chatMessages`, `notes`, `tags`

### Adding Custom Fields (Test)
- [ ] In backend console, run:
  ```typescript
  await prisma.meeting.update({
    where: { id: 'some-id' },
    data: {
      keyDecisions: ['Approved budget', 'Hired new team member'],
      highlights: ['Great presentation by John']
    }
  });
  ```
- [ ] Verify in Prisma Studio
- [ ] No errors

---

## ✅ Chat During & After Meetings

### During Meeting
- [ ] Start recording
- [ ] After 1 minute, ask: "What have we discussed?"
- [ ] AI responds with current context
- [ ] Uses live transcript (not full transcript)

### After Meeting
- [ ] Stop recording, wait for completion
- [ ] Ask same question: "What did we discuss?"
- [ ] AI responds with full context
- [ ] Uses full transcript + AI summary + action items

---

## ✅ macOS Permissions (if on macOS)

### Microphone
- [ ] System Settings → Privacy & Security → Microphone
- [ ] "Electron" or app name listed
- [ ] Toggle enabled

### Accessibility (Optional)
- [ ] System Settings → Privacy & Security → Accessibility
- [ ] Grant if needed for advanced features

### Notifications (Optional)
- [ ] System Settings → Notifications
- [ ] Allow notifications from app

---

## ✅ Error Handling

### Network Errors
- [ ] Stop backend server
- [ ] Try asking AI a question
- [ ] See error message (not crash)
- [ ] Restart backend → works again

### Invalid API Key
- [ ] Set `GROQ_API_KEY=invalid` in `backend/.env`
- [ ] Restart backend
- [ ] Try AI chat → see error message
- [ ] Fix key → works again

### Database Connection Lost
- [ ] Stop PostgreSQL: `docker stop postgres`
- [ ] Try creating a meeting
- [ ] See error message
- [ ] Restart: `docker start postgres` → works

---

## 🎉 All Features Verified!

If all checkboxes are ✅, congratulations! Your AI Meeting Copilot is **production-ready**.

---

## Performance Benchmarks

Record these metrics during testing:

| Feature | Target | Actual |
|---------|--------|--------|
| Transcription latency | <500ms | _____ |
| Transcript save (per line) | <10ms | _____ |
| SSE token latency | 50-100ms | _____ |
| Embedding generation | ~100ms | _____ |
| Vector search | <50ms | _____ |
| Live RAG total | ~200ms | _____ |
| LLM first token | 1-2s | _____ |
| Full AI response | 2-5s | _____ |

---

**Last Updated**: May 27, 2026  
**Version**: 1.1.0-production-ready
