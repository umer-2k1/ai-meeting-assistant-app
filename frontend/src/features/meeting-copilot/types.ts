export type MeetingStatus = 'live' | 'scheduled' | 'processing' | 'completed' | 'archived' | 'failed';

/** Raw status as stored by the backend. */
export type ApiMeetingStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type TranscriptLine = {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
  highlighted?: boolean;
};

export type AiAnswer = {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
  /** Set when the answer stream was interrupted; partial text is kept. */
  error?: boolean;
};

export type ActionItem = {
  id: string;
  assignee: string;
  task: string;
  due: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
};

export type CalendarEvent = {
  id: string;
  title: string;
  time: string;
  location: string;
  note: string;
  recurring?: boolean;
  /** e.g. Today, Tomorrow — used to group the agenda */
  dayLabel?: string;
  startTime?: string;
  endTime?: string;
  attendees?: number;
  /**
   * Video-call URL (Google Meet/Zoom/Teams), kept separate from `location`.
   * `location` folds this into a display string, which left Join with nothing
   * to open.
   */
  meetLink?: string;
  /** Highlight as the imminent next meeting */
  startsSoon?: boolean;
  /** Context for building a pre-meeting brief (raw attendees preserved) */
  prep?: {
    title: string;
    description?: string;
    attendees: { name: string; email?: string | null }[];
  };
};

export type MeetingNote = {
  id: string;
  content: string;
  contentHtml?: string | null;
  updatedAt?: string;
};

export type Meeting = {
  id: string;
  title: string;
  status: MeetingStatus;
  /** Human-readable date shown in detail header, e.g. May 27, 2026 */
  displayDate?: string;
  startedAt: string;
  /** ISO start time for accurate sorting/formatting */
  startTimeIso?: string;
  duration: string;
  /** Parsed duration for audio player (seconds) */
  audioDurationSeconds?: number;
  /** Optional recording URL when backend provides it */
  audioUrl?: string;
  participantCount: number;
  /** Attendee details when available (detail view) */
  attendees?: { id: string; name: string; email?: string | null; role?: string | null }[];
  /** Platform + join link when available */
  platform?: string | null;
  platformUrl?: string | null;
  summarySnippet: string;
  /** Rich HTML summary (Tiptap-compatible) for Summary tab */
  summaryHtml?: string;
  tags: string[];
  decisions: string[];
  transcript: TranscriptLine[];
  actionItems: ActionItem[];
  /** Persisted notes for this meeting (most-recent first) */
  meetingNotes?: MeetingNote[];
  /** Convenience: latest note content for the editor */
  notes: string;
  aiSummary: string;
  /** Message set when processing failed */
  processingError?: string | null;
  /** Counts (used by list cards where full arrays are not loaded) */
  actionItemCount?: number;
  isFavorite?: boolean;
};
