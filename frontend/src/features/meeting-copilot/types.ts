export type MeetingStatus = 'live' | 'completed' | 'archived';

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
  /** Highlight as the imminent next meeting */
  startsSoon?: boolean;
};

export type Meeting = {
  id: string;
  title: string;
  status: MeetingStatus;
  /** Human-readable date shown in detail header, e.g. May 27, 2026 */
  displayDate?: string;
  startedAt: string;
  duration: string;
  /** Parsed duration for audio player (seconds) */
  audioDurationSeconds?: number;
  /** Optional recording URL when backend provides it */
  audioUrl?: string;
  participantCount: number;
  summarySnippet: string;
  /** Rich HTML summary (Tiptap-compatible) for Summary tab */
  summaryHtml?: string;
  tags: string[];
  decisions: string[];
  transcript: TranscriptLine[];
  actionItems: ActionItem[];
  /** User notes — plain text or HTML */
  notes: string;
  aiSummary: string;
  isFavorite?: boolean;
};
