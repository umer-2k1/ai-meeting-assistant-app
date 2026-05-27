# AI Meeting Intelligence App — Feature Requirements Document

## 1. Overview
This document outlines the required features for an AI-powered meeting assistant application that integrates with calendar systems, provides live transcription, contextual intelligence, and post-meeting summaries with action item extraction and sharing capabilities.

Primary integrations:
- Google Calendar (via MCP server)
- Slack integration
- Email delivery system
- Optional web data enrichment (attendee intelligence)

CurrentLY WE dont have Authentication, just simple Google Authentication (no email password thing) for now

---

## 2. Core Integration: Google Calendar via MCP Server

### 2.1 MCP Server Connection
- User authenticates and connects their MCP server
- MCP server acts as a bridge to calendar provider
- Secure OAuth-based login with Google Calendar :contentReference[oaicite:0]{index=0}

### 2.2 Calendar Sync
- Fetch all user meetings from connected calendar
- Real-time sync or scheduled sync (configurable)
- Support multiple calendars per user

### 2.3 Meeting Filtering
- Filter meetings by:
  - Date range
  - Specific day selection
  - Upcoming / past meetings
  - Attendee-based filtering

---

## 3. Meeting Dashboard (Meeting Cards)

### 3.1 Meeting List View
Each meeting card should display:
- Meeting title
- Date & time (start/end)
- Attendees list
- Meeting duration
- Platform link (Zoom/Meet/etc. if available)
- Status (Upcoming / Live / Completed)

### 3.2 Meeting Detail View
- Full agenda (if available)
- Attendee breakdown
- Past related meetings (contextual history)
- Notes and AI-generated insights

---

## 4. Live Meeting Intelligence System

### 4.1 Meeting Start & Recording
- User clicks "Start Meeting Intelligence"
- System begins:
  - Audio capture
  - Live transcription engine
  - Timestamp tracking

### 4.2 Live Transcript Generation
- Real-time speech-to-text
- Speaker diarization (identify speakers)
- Timestamped transcript generation
- Editable transcript view

---

## 5. Live AI Chat Assistant

### 5.1 In-Meeting Chat
- User can ask questions during meeting:
  - “What did they just say?”
  - “Summarize last 5 minutes”
  - “What was the decision on X?”

### 5.2 Context Awareness
- Chat AI has access to:
  - Live transcript
  - Past meeting history
  - Agenda and notes
- Supports memory-based conversation within meeting session

---

## 6. Post-Meeting Intelligence

### 6.1 Automated Summary Generation
After meeting ends:
- Full meeting summary
- Key discussion points
- Decisions made
- Risks or blockers identified

### 6.2 Action Items & Tasks
- Extract:
  - To-dos
  - Assigned owners (if identifiable)
  - Deadlines (if mentioned)
- Structured output format

### 6.3 Transcript Output
- Clean formatted transcript
- Timestamped sections
- Speaker labels

### 6.4 Export Format
- Markdown export of:
  - Summary
  - Transcript
  - Action items
  - Notes

---

## 7. Sharing & Collaboration

### 7.1 Slack Integration
- Send meeting summary to Slack channels :contentReference[oaicite:1]{index=1}
- Include:
  - Summary
  - Action items
  - Key highlights

### 7.2 Email Sharing
- Send formatted meeting report via email
- Attach markdown or PDF version
- Recipient selection (attendees or custom list)

---

## 8. Pre-Meeting Intelligence System (AI Context Builder)

### 8.1 Meeting Preparation Screen
Before meeting starts, system generates:

#### 8.1.1 Past Meeting Context
- Previous meetings with same attendees
- Summary of past discussions
- Open action items from previous meetings
- Pending follow-ups

#### 8.1.2 Attendee Intelligence
- Fetch public information from web sources:
  - LinkedIn profiles
  - Company information
  - Role and bio summary
- Highlight relevance to current meeting

#### 8.1.3 Agenda Intelligence
- Extract agenda points from calendar description
- Generate structured meeting briefing:
  - Topics likely to be discussed
  - Suggested talking points
  - Reminders of client requests or tasks

---

## 9. Historical Meeting Memory System

- Store all past meetings with:
  - Transcript
  - Summary
  - Action items
- Enable retrieval for:
  - “What did we discuss last time?”
  - “What was promised to this client?”
- Semantic search across meetings

---

## 10. Future Enhancements (v2.0)

### 10.1 Predictive Meeting Context
- Auto-suggest talking points before meeting
- Predict agenda based on historical patterns

### 10.2 Advanced Relationship Intelligence
- Cross-meeting relationship mapping between attendees
- Track commitments per person/company

### 10.3 Smart Reminder System
- Notify unresolved action items before next meeting
- Highlight overdue tasks in pre-meeting brief

---

## 11. System Architecture Notes (High-Level)

- MCP Server Layer (Calendar integration)
- Real-time Audio Processing Service
- Speech-to-Text Engine
- LLM-based Intelligence Layer
- Meeting Data Storage (Transcript + Metadata)
- Notification Service (Slack/Email)
- Frontend Dashboard (Meetings + Live View + Chat)

---

## 12. Core User Flow Summary

1. User connects Google Calendar via MCP
2. Meetings are fetched and displayed
3. User selects a meeting
4. Pre-meeting intelligence is shown
5. Meeting starts → live transcription + AI chat
6. Meeting ends → summary + action items generated
7. User shares via Slack/email or saves internally
8. Historical data improves future meetings

---


## 13. Tech Stack

# 🧠 AI Tech Stack (Corrected)

## 🤖 AI / LLM Layer

* **LangChain / LangGraph** for orchestration and AI workflows
* **Groq LLM (via Groq API)** for fast inference
* **MCP Server** for tool integration (Google Calendar, external APIs, etc.)

---

## 🗄️ Database

* **PostgreSQL (PSQL)** for:

  * Users
  * Meetings metadata
  * Transcripts
  * Action items
  * Chat history

---

## 🎙️ Speech-to-Text

* **Deepgram** for:

  * Real-time transcription
  * Speaker diarization
  * Low-latency streaming audio processing

---

## 🔍 RAG (Retrieval Augmented Generation)

* **Qdrant Vector Database** for semantic memory and retrieval
* Used for:

  * Past meeting search
  * Context injection for AI chat
  * Pre-meeting intelligence

---

## 🧠 Embeddings

* **Google Gemini Embeddings** (via Gemini API)

  * For generating vector embeddings of:

    * Meeting transcripts
    * Summaries
    * Notes
    * Attendee context

---

## 📦 Document / Media Storage

* **Cloudinary**

  * Store:

    * Audio recordings
    * Generated PDFs
    * Markdown exports
    * Supporting media files

---

## 🔗 System Flow Summary

* MCP Server → fetch calendar meetings
* Deepgram → live transcription
* LangChain/LangGraph + Groq → AI reasoning & chat
* Gemini Embeddings → vectorization
* Qdrant → semantic memory (RAG)
* PostgreSQL → structured data storage
* Cloudinary → file storage (audio + exports)



## End of Document