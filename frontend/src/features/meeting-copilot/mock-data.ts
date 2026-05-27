import type { AiAnswer, CalendarEvent, Meeting, TranscriptLine } from './types';

export const starterTranscript: TranscriptLine[] = [
  {
    id: 't-live-1',
    timestamp: '00:00:15',
    speaker: 'John Martinez',
    text: "Alright team, let's dive into the Q3 roadmap. We have three main priorities for this quarter."
  },
  {
    id: 't-live-2',
    timestamp: '00:00:28',
    speaker: 'Sarah Chen',
    text: 'Before we start, I want to flag the API latency issue we have been seeing on mobile.'
  },
  {
    id: 't-live-3',
    timestamp: '00:00:45',
    speaker: 'Marcus Wong',
    text: 'That is a good point. We should prioritize that alongside the Dark Mode feature.'
  },
  {
    id: 't-live-4',
    timestamp: '00:01:02',
    speaker: 'John Martinez',
    text: "Agreed. Let's make that a P0 for the sprint.",
    highlighted: true
  }
];

export const meetings: Meeting[] = [
  {
    id: 'meeting-1',
    title: 'Product Sync Meeting',
    status: 'live',
    displayDate: 'May 27, 2026',
    startedAt: 'Today, 10:30 AM',
    duration: '45 min',
    audioDurationSeconds: 45 * 60,
    participantCount: 5,
    summarySnippet:
      'Discussed Q3 roadmap priorities and decided to launch Dark Mode while moving API latency to P0.',
    tags: ['roadmap', 'design', 'q3', 'ai-notes'],
    summaryHtml: `
      <div class="editor-callout">
        <span class="editor-callout-icon">✨</span>
        <p><em>This summary was generated automatically from your meeting recording. Review and edit before sharing.</em></p>
      </div>
      <h2>Record without a bot in your call</h2>
      <blockquote>
        <p><em>The team aligned on shipping Dark Mode in Q3 while treating mobile API latency as a sprint P0.</em></p>
      </blockquote>
      <p>
        The discussion covered roadmap priorities, design dependencies, and engineering capacity.
        Sarah flagged <mark data-color="#DBEAFE" style="background-color: #DBEAFE">automatic</mark>
        transcript quality as a requirement for client-facing demos.
      </p>
      <ul class="editor-tip-list">
        <li>Confirm Dark Mode design tokens before sprint planning</li>
        <li>Share latency benchmarks with the mobile team by Friday</li>
        <li>Schedule a follow-up with stakeholders after P0 fixes land</li>
      </ul>
      <h3>Key decisions</h3>
      <ul>
        <li>API latency issue elevated to P0 priority</li>
        <li>Dark Mode feature approved for Q3 launch</li>
      </ul>
    `,
    decisions: [
      'API latency issue elevated to P0 priority',
      'Dark Mode feature approved for Q3 launch'
    ],
    transcript: starterTranscript,
    actionItems: [
      {
        id: 'a-1',
        assignee: 'Alex',
        task: 'Finalize tech specs by Friday',
        due: 'Friday',
        timestamp: '00:12:34',
        priority: 'high'
      },
      {
        id: 'a-2',
        assignee: 'Sarah',
        task: 'Update help center articles',
        due: 'Next Monday',
        timestamp: '00:18:45',
        priority: 'medium'
      }
    ],
    notes:
      '<p>Need to align onboarding content with <strong>Dark Mode</strong> rollout.</p><p>Investigate mobile API timeout threshold.</p>',
    aiSummary:
      'The team focused on Q3 priorities with emphasis on Dark Mode delivery and reducing mobile API latency. A key decision was to treat latency as sprint P0.'
  },
  {
    id: 'meeting-2',
    title: 'Client Discovery Call',
    status: 'completed',
    startedAt: 'Yesterday, 2:00 PM',
    duration: '1h 15m',
    participantCount: 3,
    summarySnippet:
      'Captured client requirements for enterprise reporting and agreed to deliver a scope proposal.',
    tags: ['client', 'discovery'],
    decisions: ['Prepare enterprise reporting proposal by next Tuesday'],
    transcript: [
      {
        id: 't-client-1',
        timestamp: '00:07:20',
        speaker: 'Client',
        text: 'We need role-based dashboards and CSV exports for our operations team.'
      }
    ],
    actionItems: [
      {
        id: 'a-3',
        assignee: 'John',
        task: 'Send proposal draft',
        due: 'Tuesday',
        timestamp: '00:31:02',
        priority: 'high'
      }
    ],
    notes: 'Client asked for SOC2 timeline and data residency information.',
    aiSummary:
      'Discovery focused on reporting needs, data governance, and rollout timeline. Follow-up requires a scoped proposal.'
  },
  {
    id: 'meeting-3',
    title: 'Engineering Standup',
    status: 'completed',
    startedAt: 'May 9, 10:00 AM',
    duration: '28 min',
    participantCount: 6,
    summarySnippet: 'Reviewed sprint blockers and confirmed migration sequence for notifications.',
    tags: ['standup', 'engineering'],
    decisions: ['Sequence notification migration after auth hardening'],
    transcript: [
      {
        id: 't-standup-1',
        timestamp: '00:04:11',
        speaker: 'Priya',
        text: 'Auth hardening has to land first; notification changes depend on new claim checks.'
      }
    ],
    actionItems: [
      {
        id: 'a-4',
        assignee: 'Priya',
        task: 'Publish migration checklist',
        due: 'Tomorrow',
        timestamp: '00:09:20',
        priority: 'medium'
      }
    ],
    notes: 'Need compatibility test matrix before migration release.',
    aiSummary:
      'The team aligned on dependency order and agreed to gate notification migration behind auth completion.'
  }
];

export const calendarEvents: CalendarEvent[] = [
  {
    id: 'c-1',
    title: 'Client Strategy Review',
    dayLabel: 'Today',
    startTime: '2:00 PM',
    endTime: '3:00 PM',
    time: 'Today, 2:00 PM - 3:00 PM',
    location: 'Zoom Meeting',
    note: 'Starts in about 1 hour',
    startsSoon: true,
    attendees: 5
  },
  {
    id: 'c-2',
    title: 'Product Design Critique',
    dayLabel: 'Today',
    startTime: '4:30 PM',
    endTime: '5:15 PM',
    time: 'Today, 4:30 PM - 5:15 PM',
    location: 'Google Meet',
    note: 'Review mobile onboarding flows',
    attendees: 8
  },
  {
    id: 'c-3',
    title: 'Weekly Team Standup',
    dayLabel: 'Tomorrow',
    startTime: '10:00 AM',
    endTime: '10:30 AM',
    time: 'Tomorrow, 10:00 AM - 10:30 AM',
    location: 'Recurring · Slack Huddle',
    note: 'Auto-record enabled for this series',
    recurring: true,
    attendees: 12
  },
  {
    id: 'c-4',
    title: 'Q3 Planning Workshop',
    dayLabel: 'Tomorrow',
    startTime: '1:00 PM',
    endTime: '3:00 PM',
    time: 'Tomorrow, 1:00 PM - 3:00 PM',
    location: 'Conference Room B',
    note: 'Bring roadmap draft',
    attendees: 15
  }
];

export const quickAiAnswers: AiAnswer[] = [
  {
    id: 'q-1',
    question: 'Who mentioned pricing discussion?',
    answer:
      'Sarah mentioned pricing at 00:14:32 and noted that the enterprise tier should be revisited before Q3.',
    timestamp: '00:14:32'
  },
  {
    id: 'q-2',
    question: 'Did anyone disagree with the timeline?',
    answer:
      'Yes. Sarah disagreed at 00:02:20 and suggested extending the timeline by two weeks.',
    timestamp: '00:02:20'
  }
];
