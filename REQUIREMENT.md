# AI Meeting Copilot - Complete Project Documentation

## 🎯 Executive Summary

**Product Name:** AI Meeting Copilot  
**Type:** Desktop Application (Electron-based)  
**Target Platform:** macOS, Windows, Linux  
**Core Value Proposition:** A real-time AI desktop assistant that records meetings, generates actionable intelligence, and integrates seamlessly with productivity tools—eliminating the need for manual note-taking and meeting follow-ups.
Fireflies.ai and Speller.ai.
---
Keep frontend and backend in separate folders within the same app. Use design-theme.png for UI theme/colors. Frontend in React Vite, Shadcn, Tailwind css is already set up in the frontend folder as boiler template.


## 📋 Table of Contents

1. [Product Overview](#product-overview)
2. [Core Features & Functionality](#core-features)
3. [Technical Stack](#technical-stack)
4. [System Architecture](#system-architecture)
5. [UI/UX Requirements](#uiux-requirements)
6. [Data Architecture](#data-architecture)
7. [API Integrations](#api-integrations) 

---

## 1. Product Overview

### 1.1 Product Vision

Create a **Fireflies.ai/Speller.ai competitor** that lives natively on the desktop, providing:
- Zero-friction meeting recording and transcription
- Real-time AI-powered insights during meetings
- Intelligent post-meeting analysis and action item extraction
- Seamless integration with existing productivity workflows

### 1.2 Target Users

- **Product Managers** - Track decisions and action items
- **Sales Teams** - Capture client requirements and commitments
- **Engineering Teams** - Document technical discussions and decisions
- **Executives** - Stay informed on key meetings without attending
- **Remote Teams** - Maintain meeting context across time zones

### 1.3 Key Differentiators

1. **Native Desktop Experience** - No browser dependencies, better performance
2. **Real-time AI Intelligence** - Live insights during meetings, not just post-processing
3. **Privacy-First** - Local storage with user-controlled data
4. **Conversational AI** - "Ask the Meeting" feature for natural language queries
5. **Deep Integrations** - Gmail, Slack, Google Calendar connectors

---

## 2. Core Features & Functionality

### 2.1 Meeting Recording System

#### **Real-time Audio Capture**
- System audio capture (for virtual meetings)
- Microphone input (for in-person meetings)
- Dual-track recording (speaker separation)
- Pause/Resume functionality
- Background recording with minimal CPU usage

#### **Recording Controls**
- One-click start/stop
- Visual recording indicator (always-on-top widget)
- Recording timer with elapsed time
- Quick access to controls via system tray
- Keyboard shortcuts (⌘K for start/stop)

---

### 2.2 Live Transcription Engine

#### **Speech-to-Text Processing**
- **Provider:** Deepgram Nova-2
- **Features:**
  - Real-time streaming transcription
  - Speaker diarization (who spoke when)
  - Timestamp per sentence
  - Support for 30+ languages
  - Custom vocabulary for technical terms

#### **Transcript Display**
```
[00:02:13] John: We should ship next week
[00:02:20] Sarah: I disagree with the timeline
[00:02:45] Marcus: Let me check the backlog
```

#### **Transcript Features**
- Live updating transcript view
- Auto-scroll with manual override
- Search within transcript
- Highlight key moments
- Copy/export specific sections

---

### 2.3 AI Meeting Intelligence

#### **Real-time AI Processing**
- **Provider:** Groq (Llama 3.1-70B)
- **Agent Framework:** LangGraph for stateful AI workflows

#### **Live Intelligence (During Meeting)**
1. **Key Points Detection**
   - Automatically identifies important statements
   - Flags decisions being made
   - Highlights risks or concerns mentioned

2. **Continuous Summary**
   - Progressive summary that updates every 2 minutes
   - Topic clustering
   - Sentiment analysis

#### **Post-Meeting Intelligence**
Generated within 30 seconds of meeting end:

1. **Executive Summary**
   - 3-5 sentence overview
   - Main discussion topics
   - Overall outcome

2. **Key Decisions**
   - What was decided
   - Who made the decision
   - Timestamp reference

3. **Action Items**
   - Task description
   - Assigned person (if mentioned)
   - Deadline (if mentioned)
   - Priority level (inferred)

4. **Risks & Concerns**
   - Potential blockers identified
   - Unresolved issues
   - Dependencies noted

5. **Important Highlights**
   - Quotable moments
   - Breakthrough ideas
   - Critical data points

6. **Learnings & Insights**
   - Lessons learned
   - Best practices mentioned
   - Knowledge shared

---

### 2.4 "Ask the Meeting" AI Feature ⭐

#### **Core Capability**
Natural language question-answering over meeting transcripts using RAG (Retrieval-Augmented Generation).

#### **Example Queries**
```
User: "Who mentioned the pricing discussion?"
AI: "Sarah mentioned pricing at 00:14:32, saying 'We need 
     to revisit our enterprise tier pricing before Q3.'"

User: "What are my action items?"
AI: "You have 2 action items:
     1. Follow up with the design team by Friday (00:18:45)
     2. Share the API documentation with John (00:22:10)"

User: "Did anyone disagree with the timeline?"
AI: "Yes, Sarah expressed concern at 00:02:20: 'I disagree 
     with the timeline.' She suggested a 2-week extension."
```

#### **Technical Implementation**
- Vector embeddings of transcript chunks (sentence-level)
- Semantic search using cosine similarity
- Context-aware response generation
- Timestamp attribution for every answer

---

### 2.5 Meeting Sessions Dashboard

#### **Meeting Organization**
```
Recent Meetings
├── Live Sessions (red indicator)
├── Today
├── Yesterday
├── This Week
├── This Month
└── Older
```

#### **Meeting Card UI Elements**
Each meeting displays:
- Auto-generated or custom title
- Date and duration
- Participant count (if detected)
- Summary snippet (first 100 chars)
- Action items count badge
- Quick actions (Open, Export, Delete)
- Tags/labels for categorization

#### **Dashboard Features**
- Full-text search across all meetings
- Filter by date range, tags, participants
- Sort by date, duration, relevance
- Bulk operations (export, delete)
- Archive functionality

---

### 2.6 Floating Widget (Always Visible)

#### **Mini Recording UI**
A small, draggable window that stays on top of all applications:

```
┌─────────────────────────┐
│ 🔴 Recording            │
│ 00:12:44               │
│ [Ask AI] [Pause] [Stop] │
└─────────────────────────┘
```

#### **Widget Features**
- Minimal footprint (280px × 100px)
- Semi-transparent when inactive
- Click-through mode (optional)
- Keyboard activation (⌘⇧A for Ask AI)
- Position memory (remembers last location)
- Snap to screen edges

---

### 2.7 Calendar Integration

#### **Google Calendar Connector**
- OAuth 2.0 authentication
- Read access to calendar events
- Fetch upcoming meetings (next 7 days)
- Fetch past meetings (last 30 days)

#### **Calendar Features**
1. **Meeting Suggestions**
   - "You have a meeting in 5 minutes - Start recording?"
   - Auto-populate meeting title from calendar event

2. **Meeting History Linking**
   - Match recorded meetings to calendar events
   - Show calendar context in meeting details

3. **Calendar View**
   - Day/Week/Month views
   - Click to start recording for scheduled meetings
   - Visual indicator for recorded vs. unrecorded meetings

---

### 2.8 Smart Notifications

#### **Pre-Meeting Alerts**
- "Meeting starts in 5 minutes - Product Sync"
- "Meeting starting now - Start recording?"

#### **During Meeting**
- "Recording has been running for 60 minutes"
- "Action item detected: Follow up with John"

#### **Post-Meeting**
- "Meeting ended - Summary generated"
- "3 action items extracted"
- Notification click opens meeting detail page

#### **Notification Preferences**
- Configurable timing (5/10/15 min before)
- Sound/banner preferences
- Do Not Disturb mode
- Critical-only mode

---

### 2.9 Notes System

#### **Manual Notes**
- Rich text editor within each meeting
- Add notes during or after meetings
- Timestamp-linked notes (anchor to transcript moment)
- Markdown support

#### **AI-Generated Notes**
- Automatic note suggestions
- Editable AI summaries
- Highlight expansion (click highlight → full context)

#### **Note Features**
- Search within notes
- Tag notes (#decision, #action, #question)
- Export notes separately
- Share specific notes via Slack/Email

---

### 2.10 Integration System

#### **Slack Integration**
**OAuth Scopes Required:**
- `chat:write` - Send messages
- `files:write` - Upload summaries
- `channels:read` - List channels

**Features:**
- Send meeting summary to Slack channel
- Send action items to specific person
- Auto-create threads for meeting discussions
- Schedule summary delivery (immediate/end-of-day)

**Example Slack Message:**
```
📋 Meeting Summary: Product Sync (45 min)

**Key Decisions:**
• Approved "Dark Mode" feature for Q3 launch
• Delayed API v2 migration to Q4

**Action Items:**
• @alex - Finalize tech specs by Friday
• @sarah - Update help center articles

[View Full Transcript] [Ask AI About This Meeting]
```

---

#### **Gmail Integration**
**OAuth Scopes Required:**
- `gmail.send` - Send emails
- `gmail.compose` - Draft emails

**Features:**
- Auto-generate meeting follow-up email
- Insert summary into email body
- Attach PDF transcript
- Smart recipient detection (from transcript)

**Example Email:**
```
Subject: Follow-up: Product Sync - Feb 11, 2026

Hi team,

Thanks for the productive discussion today. Here's a summary:

**Key Outcomes:**
• Approved the new Dark Mode design
• User retention increased by 12% in Q3
• Discussed API latency issues on mobile

**Action Items:**
• Alex: Finalize tech specs by Friday
• Sarah: Update help center articles
• Marcus: Schedule demo with marketing team

Full transcript and AI insights are available in Spellar.

Best,
[Your Name]
```

---

#### **Google Calendar Integration**
Already covered in section 2.7

---

### 2.11 Export System

#### **Export Formats**
1. **PDF**
   - Full transcript with timestamps
   - AI summary section
   - Action items list
   - Professional formatting

2. **TXT**
   - Plain text transcript
   - Markdown-formatted summary

3. **JSON**
   - Structured data export
   - For API integrations
   - Includes all metadata

4. **DOCX**
   - Microsoft Word format
   - Editable transcript
   - Styled headings and lists

#### **Export Destinations**
- Local file system
- Email attachment
- Slack message
- Google Drive (future)
- Notion (future)

---

### 2.12 Settings & Preferences

#### **General Settings**
- Language preference
- Time format (12h/24h)
- Date format
- Theme (Light/Dark/System)

#### **Audio Settings**
- Input device selection
- Output device monitoring
- Audio quality (bitrate)
- Noise suppression toggle
- Echo cancellation toggle

#### **AI Preferences**
- Summary length (brief/detailed)
- Action item sensitivity (aggressive/balanced/conservative)
- AI response style (concise/explanatory)
- Custom AI instructions
- Language model selection (when multiple available)

#### **Integrations**
- Connected accounts management
- Default Slack channel for summaries
- Email signature customization
- Calendar sync frequency

#### **Privacy & Storage**
- Data retention policy (30/60/90 days/forever)
- Auto-delete old meetings
- Export all data
- Delete all data

#### **Keyboard Shortcuts**
- Customizable hotkeys
- Global shortcuts (work outside app)
- Quick actions menu

---

## 3. Technical Stack

### 3.1 Frontend Framework

#### **Core Technologies**
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite 5.x
- **Styling:** Tailwind CSS 3.x
- **Component Library:** shadcn/ui
- **State Management:** Zustand (for local state) + React Query (for server state)
- **Routing:** React Router v6
 

---

### 3.2 Desktop Framework

#### **Electron Configuration**
- **Version:** Electron 28.x
- **Architecture:** Main process + Preload + Renderer
- **IPC:** Electron IPC for secure communication
- **Security:** Context isolation enabled, Node integration disabled in renderer

#### **Electron Builder**
- Packaging for macOS (.dmg, .app)
- Packaging for Windows (.exe, .msi)
- Packaging for Linux (.AppImage, .deb)
- Auto-updater integration
- Code signing for distribution

---

### 3.3 Backend Services (Electron Main Process)

#### **Audio Processing**
- **Library:** `node-audio-recorder` or `web-audio-api`
- **Format:** WAV/MP3 encoding
- **Streaming:** Chunk-based streaming to STT service

#### **Real-time Communication**
- **WebSocket:** For streaming audio to Deepgram
- **Server-Sent Events (SSE):** For receiving live transcripts

---

### 3.4 Database

#### **PostgreSQL**
- **Version:** PostgreSQL 15+
- **Hosting Options:**
  - Local PostgreSQL installation (for development)
  - Supabase (managed PostgreSQL for production)
  - Neon (serverless PostgreSQL alternative)

#### **ORM: Prisma**
- **Version:** Prisma 5.x
- **Features:**
  - Type-safe database client
  - Schema migrations
  - Prisma Studio for data inspection
  - Connection pooling
 

### 3.5 AI & NLP Services

#### **Speech-to-Text: Deepgram**
- **Model:** Nova-2 (latest, highest accuracy)
- **Features Used:**
  - Real-time streaming
  - Speaker diarization
  - Custom vocabulary
  - Punctuation and capitalization
  - Interim results for live UI updates

---

#### **LLM: Groq**
- **Models:**
  - Primary: `llama-3.1-70b-versatile` (for intelligence)
  - Secondary: `llama-3.1-8b-instant` (for quick queries)
  - Embeddings: `text-embedding-ada-002` (via OpenAI for RAG)

**Use Cases:**
- Meeting summarization
- Action item extraction
- Key decision identification
- Risk analysis
- Q&A over transcripts

---

#### **AI Agent Framework: LangGraph**
- **Purpose:** Stateful AI workflows with multi-step reasoning
- **Use Case:** "Ask the Meeting" feature with context retention

**LangGraph Workflow:**
```
User Query → Query Analysis → Semantic Search → Context Retrieval 
→ LLM Response Generation → Timestamp Attribution → User Answer
```

---

#### **Alternative: LangChain**
- Used for simpler RAG pipelines
- Document loaders for transcript processing
- Vector store integration (pgvector in PostgreSQL)

---

### 3.6 Vector Database (for Semantic Search)

#### **pgvector Extension in PostgreSQL**
- Store transcript embeddings directly in PostgreSQL
- Enable semantic search with `<->` operator
- Index embeddings with HNSW for fast retrieval

**Schema Addition:**
```prisma
model TranscriptChunk {
  id            String   @id @default(cuid())
  transcriptId  String
  text          String
  embedding     Unsupported("vector(1536)") // pgvector type
  startTime     String
  endTime       String
}
```

---

### 3.7 Development Tools

#### **Code Quality**
- **Linting:** ESLint with TypeScript rules
- **Formatting:** Prettier
- **Pre-commit Hooks:** Husky + lint-staged
- **Type Checking:** TypeScript strict mode
 
#### **Monitoring & Debugging**
- **Logging:** Winston (for structured logs) 

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE (React)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │  Live    │  │ Meeting  │  │Settings  │   │
│  │          │  │Recording │  │ Detail   │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↕ IPC Bridge
┌─────────────────────────────────────────────────────────────┐
│              ELECTRON MAIN PROCESS (Node.js)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   IPC Handlers                        │  │
│  │  audio.ipc  meetings.ipc  ai.ipc  calendar.ipc      │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Services Layer                       │  │
│  │  AudioCapture  STT  LLM  Meeting  Storage  Calendar  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Deepgram  │  │  Groq    │  │PostgreSQL│  │ Google   │   │
│  │  (STT)   │  │  (AI)    │  │ (Prisma) │  │   APIs   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.2 Data Flow Diagrams

#### **Meeting Recording Flow**

```
[User Clicks "Start Recording"]
         ↓
[Electron Main: Initialize Audio Capture]
         ↓
[Capture System Audio/Microphone] ←─┐
         ↓                           │
[Stream Audio Chunks]                │
         ↓                           │
[Send to Deepgram via WebSocket]    │
         ↓                           │
[Receive Live Transcript]            │ (Loop until stopped)
         ↓                           │
[Store Transcript Sentence in DB]    │
         ↓                           │
[Send to React UI via IPC]           │
         ↓                           │
[Update Live Transcript View] ───────┘
         ↓
[User Clicks "Stop Recording"]
         ↓
[Finalize Meeting Session]
         ↓
[Trigger AI Summarization]
         ↓
[Generate Summary & Action Items]
         ↓
[Store in Database]
         ↓
[Show Summary in UI]
```

---

#### **Ask the Meeting AI Flow**

```
[User Types Question: "What did John say?"]
         ↓
[Send Query to Electron Main via IPC]
         ↓
[Generate Query Embedding (OpenAI)]
         ↓
[Semantic Search in pgvector]
         ↓
[Retrieve Top 5 Relevant Transcript Chunks]
         ↓
[Construct Context for LLM]
         ↓
[Send to Groq with Query + Context]
         ↓
[LLM Generates Answer with Timestamp]
         ↓
[Return Answer to React UI]
         ↓
[Display Answer with Clickable Timestamp]
```

---

### 4.3 Real-time Synchronization

#### **Live Transcript Streaming**
- **WebSocket Connection:** Electron Main → Deepgram
- **IPC Streaming:** Electron Main → React UI (every 500ms batch)
- **UI Update Strategy:** Virtual scrolling with auto-scroll override

#### **AI Intelligence Updates**
- **Batch Processing:** Every 2 minutes during live meeting
- **Progressive Summary:** Append new key points without recomputing entire summary
- **Action Item Detection:** Pattern matching + LLM verification

---

### 4.4 Security Architecture

#### **Authentication & Authorization**
- **OAuth 2.0:** For Google Calendar, Gmail, Slack use MCP
- **Token Storage:** Electron's `safeStorage` module (OS-level encryption)
- **API Keys:** Environment variables, never in source code

#### **Data Security**
- **Encryption at Rest:** Database-level encryption (PostgreSQL)
- **Encryption in Transit:** TLS 1.3 for all API calls
- **Local Storage:** User data stored locally by default
- **Cloud Sync:** Optional, with end-to-end encryption

#### **Electron Security Best Practices**
- Context isolation enabled
- Node integration disabled in renderer
- Content Security Policy (CSP)
- No remote code execution
- Signed and notarized builds

---

## 5. UI/UX Requirements

### 5.1 Design System

#### **Color Palette**
Based on the reference images (Speller.ai style):

**Primary Colors:**
- Deep Blue: `#1E3A8A` (primary actions, headers)
- Electric Blue: `#3B82F6` (accents, active states)
- Cyan Accent: `#06B6D4` (highlights, progress indicators)

**Neutral Colors:**
- Background Dark: `#0F172A` (main background)
- Card Background: `#1E293B` (elevated surfaces)
- Border: `#334155` (dividers, outlines)
- Text Primary: `#F1F5F9` (main text)
- Text Secondary: `#94A3B8` (supporting text)

**Semantic Colors:**
- Success: `#10B981` (completed actions)
- Warning: `#F59E0B` (pending items)
- Error: `#EF4444` (critical items, delete)
- Info: `#3B82F6` (informational states)

**Gradient Backgrounds:**
- Hero Gradient: `linear-gradient(135deg, #667EEA 0%, #764BA2 100%)`
- Card Hover: `linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)`

---

#### **Typography**
- **Font Family:** Inter (primary), SF Pro (macOS), Segoe UI (Windows)
- **Font Sizes:**
  - Display: 36px (hero sections)
  - H1: 28px (page titles)
  - H2: 22px (section headers)
  - H3: 18px (subsection headers)
  - Body: 14px (main text)
  - Small: 12px (timestamps, metadata)
- **Font Weights:**
  - Regular: 400
  - Medium: 500
  - Semibold: 600
  - Bold: 700

---

#### **Spacing System (Tailwind)**
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
- Usage:
  - `space-2` (8px): tight spacing
  - `space-4` (16px): default spacing
  - `space-6` (24px): section spacing
  - `space-8` (32px): large gaps

---

#### **Border Radius**
- Small: 4px (buttons, inputs)
- Medium: 8px (cards, dropdowns)
- Large: 12px (modals, panels)
- XL: 16px (hero sections)

---

#### **Shadows**
```css
/* Card Shadow */
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3),
            0 2px 4px -1px rgba(0, 0, 0, 0.2);

/* Elevated Shadow */
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4),
            0 4px 6px -2px rgba(0, 0, 0, 0.3);

/* Floating Widget Shadow */
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5),
            0 10px 10px -5px rgba(0, 0, 0, 0.4);
```

---

### 5.2 Layout Structure

#### **Desktop Application Layout**

```
┌──────────────────────────────────────────────────────────────┐
│  App Titlebar (custom, frameless window)                     │
│  [Logo] Meeting Copilot              [_] [□] [✕]            │
├────────┬────────────────────────────────────────┬────────────┤
│        │                                        │            │
│ Side   │        Main Content Area              │   AI       │
│ bar    │                                        │  Panel     │
│        │                                        │            │
│ 240px  │               Flexible                 │  320px     │
│        │                                        │            │
│        │                                        │            │
│        │                                        │            │
│        │                                        │            │
└────────┴────────────────────────────────────────┴────────────┘
```

---

### 5.3 Screen-by-Screen UI Specifications

#### **5.3.1 Dashboard Screen**

**Layout:**
- **Sidebar (Left):** 240px fixed width
- **Main Area (Center):** Flexible width (min 600px)
- **No right panel on dashboard**

**Components:**

**Sidebar:**
```
┌─ Sidebar ──────────────────┐
│ [Profile Avatar]           │
│ John Doe                   │
│ john@company.com           │
│                            │
│ ➤ Dashboard     [active]   │
│   🎙 Live Session          │
│   📅 Calendar              │
│   ⚙️ Settings              │
│                            │
│ ── RECENT ──               │
│ Product Sync               │
│ Client Call                │
│ Team Standup               │
│                            │
│ [+ New Recording]          │
└────────────────────────────┘
```

**Main Content:**
```
┌─ Dashboard ─────────────────────────────────────────┐
│                                                      │
│  🔍 [Search all meetings...]          [Filters ▼]   │
│                                                      │
│  [+ Start New Recording]  [Import Audio]            │
│                                                      │
│  ── Recent Meetings ──                              │
│                                                      │
│  ┌─ Meeting Card ────────────────────────────────┐  │
│  │ 🟢 Product Sync Meeting                       │  │
│  │ Today, 10:30 AM • 45 min • 5 participants     │  │
│  │                                                │  │
│  │ Discussed Q3 roadmap priorities and decided   │  │
│  │ to launch Dark Mode feature...                │  │
│  │                                                │  │
│  │ [#roadmap] [#design] [#q3]                    │  │
│  │                                                │  │
│  │ ✓ 3 Action Items  💬 2 Decisions  📋 Summary  │  │
│  │                                                │  │
│  │ [Open Meeting →]                              │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Meeting Card ────────────────────────────────┐  │
│  │ Client Discovery Call                         │  │
│  │ Yesterday, 2:00 PM • 1h 15min                │  │
│  │ ...                                           │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

#### **5.3.2 Live Recording Screen**

**Layout:**
- **Sidebar (Left):** 240px (minimized to 60px during recording)
- **Main Area (Center):** Transcript view
- **Right Panel:** AI Intelligence Panel (320px)

**Main Content:**
```
┌─ Live Recording ────────────────────────────────────┐
│ 🔴 RECORDING                        Timer: 00:12:44  │
│ Meeting Title: Product Sync (editable)              │
│                                                      │
│ [⏸ Pause]  [⏹ Stop]  [⭐ Highlight]  [💬 Note]    │
│                                                      │
│ ── Live Transcript ──                               │
│                                                      │
│ [00:00:15] John Martinez                            │
│ Alright team, let's dive into the Q3 roadmap.       │
│ We have three main priorities for this quarter.     │
│                                                      │
│ [00:00:28] Sarah Chen                               │
│ Before we start, I want to flag the API latency     │
│ issue we've been seeing on mobile.                  │
│                                                      │
│ [00:00:45] Marcus Wong                              │
│ That's a good point. We should prioritize that      │
│ alongside the Dark Mode feature.                    │
│                                                      │
│ [00:01:02] John Martinez ⭐ (Highlighted)           │
│ Agreed. Let's make that a P0 for the sprint.        │
│                                                      │
│ [Transcript auto-scrolls...]                        │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ 💬 Ask the AI...                            │    │
│ │ [What did Sarah say about mobile?    ] [→] │    │
│ └─────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**AI Panel (Right):**
```
┌─ AI Assistant ──────────────┐
│ 🤖 Live Intelligence        │
│                             │
│ ── Summary (updating...) ── │
│                             │
│ Team is discussing Q3       │
│ priorities. Key focus:      │
│ • Dark Mode feature         │
│ • API latency fixes         │
│ • Mobile performance        │
│                             │
│ ── Key Decisions ──         │
│                             │
│ 💡 API latency is now P0    │
│    priority for sprint      │
│                             │
│ ── Action Items ──          │
│                             │
│ ⚠️ None detected yet        │
│                             │
│ ── Risks ──                 │
│                             │
│ • Mobile API performance    │
│   concerns raised           │
│                             │
└─────────────────────────────┘
```

---

#### **5.3.3 Floating Widget**

**Dimensions:** 320px × 120px  
**Position:** Draggable, stays on top  
**Appearance:** Semi-transparent background, rounded corners

```
┌──────────────────────────────────┐
│ ⚡ AI Meeting Copilot            │
│                                  │
│ 🔴 Recording        00:12:44    │
│                                  │
│ Product Sync Meeting             │
│                                  │
│ [Ask AI] [⏸ Pause] [⏹ Stop]    │
└──────────────────────────────────┘
```

**Interaction:**
- Click "Ask AI" → Opens inline input field
- Hover → Shows full opacity
- Idle → Semi-transparent (60% opacity)
- Drag from header bar to reposition

---

#### **5.3.4 Meeting Detail Page**

**Layout:**
- **Sidebar (Left):** 240px
- **Main Area (Center):** Tabbed content
- **Right Panel:** AI Insights (320px)

**Header:**
```
┌─ Meeting Detail ────────────────────────────────────────────┐
│ ← Back to Dashboard                                          │
│                                                              │
│ Product Sync Meeting                              [Edit]    │
│ Feb 11, 2026 • 10:30 AM • 45 minutes                       │
│                                                              │
│ [#roadmap] [#design] [#q3]                     [+ Add Tag]  │
│                                                              │
│ [🔗 Share] [📄 Export] [✉️ Email] [💬 Slack] [🗑️ Delete]  │
└──────────────────────────────────────────────────────────────┘
```

**Tabbed Content:**
```
┌──────────────────────────────────────────────────────────────┐
│ [Summary] [Transcript] [Action Items] [Notes] [AI Chat]      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ [Currently showing: Summary Tab]                             │
│                                                              │
│ ── Executive Summary ──                                      │
│                                                              │
│ The team discussed Q3 priorities with focus on Dark Mode     │
│ feature launch and resolving API latency issues. Key decision│
│ made to prioritize mobile performance improvements as P0.    │
│                                                              │
│ ── Topics Discussed ──                                       │
│ • Q3 Roadmap Planning                                        │
│ • Dark Mode Feature Scope                                    │
│ • API Latency Issues (Mobile)                                │
│ • Sprint Planning                                            │
│                                                              │
│ ── Key Decisions ──                                          │
│                                                              │
│ 💡 API latency issue elevated to P0 priority                 │
│    Timestamp: [00:01:02] - Click to view in transcript       │
│                                                              │
│ 💡 Dark Mode feature approved for Q3 launch                  │
│    Timestamp: [00:08:15]                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**AI Insights Panel (Right):**
```
┌─ AI Insights ───────────────┐
│                             │
│ ── Action Items ──          │
│                             │
│ ☐ @Alex - Finalize tech     │
│   specs by Friday           │
│   [00:12:34]                │
│                             │
│ ☐ @Sarah - Update help      │
│   center articles           │
│   [00:18:45]                │
│                             │
│ ☐ Schedule demo with        │
│   marketing team            │
│   [00:22:10]                │
│                             │
│ ── Quick Stats ──           │
│                             │
│ 📊 Speaking Time            │
│ John: 45%                   │
│ Sarah: 30%                  │
│ Marcus: 25%                 │
│                             │
│ 💬 Total Sentences: 248     │
│ ⏱️ Avg Speaking Speed: 145  │
│    words/min                │
│                             │
│ [Ask AI About Meeting...]   │
│                             │
└─────────────────────────────┘
```

---

#### **5.3.5 Calendar Integration Screen**

```
┌─ Calendar ──────────────────────────────────────────────────┐
│                                                              │
│ 📅 Google Calendar                    [Connected ✓]         │
│ john@company.com                          [Disconnect]       │
│                                                              │
│ [◀ May 2026 ▶]                           [Today]           │
│                                                              │
│ ── Upcoming Meetings ──                                      │
│                                                              │
│ Today, 2:00 PM                                               │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Client Strategy Review                                  │  │
│ │ 2:00 PM - 3:00 PM                                      │  │
│ │ 📍 Zoom Meeting                                        │  │
│ │                                                         │  │
│ │ Meeting starts in 1 hour 15 minutes                    │  │
│ │                                                         │  │
│ │ [⏺ Start Recording at Meeting Time] [Set Reminder]    │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ Tomorrow, 10:00 AM                                           │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Weekly Team Standup                                     │  │
│ │ 10:00 AM - 10:30 AM                                    │  │
│ │ 🔄 Recurring                                           │  │
│ │                                                         │  │
│ │ [⏺ Auto-Record This Meeting]                          │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ── Past Meetings (Recorded) ──                              │
│                                                              │
│ Yesterday, 3:00 PM - Product Review (recorded ✓)            │
│ May 9, 10:00 AM - Sprint Planning (recorded ✓)              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

#### **5.3.6 Settings Screen**

```
┌─ Settings ──────────────────────────────────────────────────┐
│                                                              │
│ [General] [Audio] [AI Preferences] [Integrations] [Privacy] │
│                                                              │
│ ── Integrations ──                                          │
│                                                              │
│ ┌─ Connected Services ────────────────────────────────────┐ │
│ │                                                          │ │
│ │ 📧 Gmail                                    [Connected]  │ │
│ │ john@company.com                         [Disconnect]  │ │
│ │                                                          │ │
│ │ Options:                                                 │ │
│ │ ☑️ Auto-generate follow-up emails                       │ │
│ │ ☑️ Include transcript attachment                        │ │
│ │ ☑️ Smart recipient detection                            │ │
│ │ ☐ CC yourself on all emails                            │ │
│ │                                                          │ │
│ │ Email Signature:                                         │ │
│ │ [This summary was generated by AI Meeting Copilot]      │ │
│ │                                                          │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💬 Slack                                    [Connected]  │ │
│ │ @johndoe · company.slack.com             [Disconnect]  │ │
│ │                                                          │ │
│ │ Default Channel for Summaries:                           │ │
│ │ [#product-team                              ▼]          │ │
│ │                                                          │ │
│ │ Send summaries:                                          │ │
│ │ ( ) Immediately after meeting ends                       │ │
│ │ (•) At end of day (6:00 PM)                             │ │
│ │ ( ) Manually only                                        │ │
│ │                                                          │ │
│ │ ☑️ Include action items                                 │ │
│ │ ☑️ Thread summaries by meeting                          │ │
│ │ ☐ @mention people for action items                     │ │
│ │                                                          │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📅 Google Calendar                          [Connected]  │ │
│ │ john@company.com                         [Disconnect]  │ │
│ │                                                          │ │
│ │ ☑️ Show upcoming meetings in app                        │ │
│ │ ☑️ Pre-meeting reminders (5 minutes before)             │ │
│ │ ☐ Auto-start recording for scheduled meetings          │ │
│ │                                                          │ │
│ │ Sync frequency: [Every 15 minutes          ▼]          │ │
│ │                                                          │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Connect New Service ▼]                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---
 
### 5.5 Responsive Design

#### **Minimum Window Sizes**
- Minimum Width: 1024px
- Minimum Height: 768px
- Recommended: 1440px × 900px (optimal viewing)

#### **Sidebar Behavior**
- **>1440px:** Sidebar always visible (240px)
- **1024px-1440px:** Sidebar visible, right panel collapsible
- **<1024px:** Sidebar collapses to icon-only (60px)

#### **Right Panel Behavior**
- **>1600px:** Always visible (320px)
- **1200px-1600px:** Collapsible with toggle button
- **<1200px:** Hidden by default, opens as overlay

---

### 5.6 Animations & Transitions

#### **Micro-interactions**
- **Button Hover:** Scale 1.05, transition 150ms
- **Card Hover:** Translate Y -2px, shadow elevation, 200ms
- **Loading States:** Skeleton screens with shimmer effect
- **Success Feedback:** Green checkmark with scale-in animation
- **Error States:** Red shake animation (3 cycles, 300ms)

#### **Page Transitions**
- **Route Changes:** Fade + slide (300ms ease-out)
- **Modal Open:** Scale from 0.95 to 1.0 + fade (200ms)
- **Panel Toggle:** Slide in/out (250ms ease-in-out)

#### **Recording State**
- **Recording Dot:** Pulsing animation (1s loop, ease-in-out)
- **Live Transcript:** Fade in new sentences (300ms)
- **AI Summary Update:** Highlight flash (yellow → transparent, 500ms)

---

### 5.7 Accessibility (A11y)

#### **Keyboard Navigation**
- **Tab Order:** Logical flow through interface
- **Shortcuts:**
  - `⌘N` - New recording
  - `⌘K` - Open command palette
  - `⌘/` - Search
  - `Space` - Pause/Resume recording
  - `Esc` - Close modals
  - `⌘⇧A` - Ask AI

#### **Screen Reader Support**
- ARIA labels on all interactive elements
- Live regions for transcript updates
- Semantic HTML (header, nav, main, aside)
- Descriptive button labels
  

---

## 7. API Integrations

### 7.1 Deepgram (Speech-to-Text)

 
#### **WebSocket Streaming**
```typescript
const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
const dgConnection = deepgram.transcription.live(deepgramConfig);

dgConnection.on('open', () => {
  console.log('Deepgram connection opened');
  
  // Start streaming audio chunks
  audioStream.on('data', (chunk) => {
    dgConnection.send(chunk);
  });
});

dgConnection.on('transcriptReceived', (data) => {
  const transcript = data.channel.alternatives[0].transcript;
  const speaker = data.speaker; // Speaker diarization
  const startTime = data.start;
  const endTime = data.start + data.duration;
  
  // Send to UI via IPC
  mainWindow.webContents.send('transcript:update', {
    transcript,
    speaker: `Speaker ${speaker}`,
    timestamp: formatTimestamp(startTime),
    startSeconds: startTime,
    endSeconds: endTime
  });
  
  // Store in database
  await prisma.transcriptSentence.create({
    data: {
      transcriptId: currentTranscriptId,
      text: transcript,
      speaker: `Speaker ${speaker}`,
      timestamp: formatTimestamp(startTime),
      startSeconds: startTime,
      endSeconds: endTime,
      confidence: data.channel.alternatives[0].confidence
    }
  });
});
```

#### **Error Handling**
- Reconnect on WebSocket disconnect
- Fallback to Whisper API for critical recordings
- Store audio locally as backup

---

## 8. Open Questions & Decisions Needed

### 8.1 Technical Decisions

1. **System Audio Capture on macOS**
   - Issue: macOS Catalina+ requires screen recording permissions
   use -> BlackHole Virtual Audio Device + Native Recording

2. **Embedding Model Choice**
   - OpenAI `text-embedding-ada-002` ($0.0001/1K tokens) use Gemini
   - vs. Open-source (e.g., sentence-transformers)

3. **Database Hosting for Production** 
   - Use Supabase managed by cloud

---
 
 