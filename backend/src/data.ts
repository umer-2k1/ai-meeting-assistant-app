export type ApiMeeting = {
  id: string;
  title: string;
  startedAt: string;
  duration: string;
  summary: string;
};

export const sampleMeetings: ApiMeeting[] = [
  {
    id: 'meeting-1',
    title: 'Product Sync Meeting',
    startedAt: '2026-05-26T10:30:00.000Z',
    duration: '45m',
    summary: 'Q3 priorities reviewed. API latency moved to P0 and Dark Mode approved.'
  },
  {
    id: 'meeting-2',
    title: 'Client Discovery Call',
    startedAt: '2026-05-25T14:00:00.000Z',
    duration: '75m',
    summary: 'Enterprise reporting requirements captured and follow-up proposal planned.'
  }
];

export const sampleTranscript = [
  {
    timestamp: '00:00:15',
    speaker: 'John Martinez',
    text: "Alright team, let's dive into the Q3 roadmap."
  },
  {
    timestamp: '00:00:28',
    speaker: 'Sarah Chen',
    text: 'Before we start, I want to flag the API latency issue on mobile.'
  }
];
