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
};

export type Meeting = {
  id: string;
  title: string;
  status: MeetingStatus;
  startedAt: string;
  duration: string;
  participantCount: number;
  summarySnippet: string;
  tags: string[];
  decisions: string[];
  transcript: TranscriptLine[];
  actionItems: ActionItem[];
  notes: string;
  aiSummary: string;
};
