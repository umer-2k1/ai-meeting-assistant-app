import { useEffect, useMemo, useState } from 'react';

import {
  IconArrowUp,
  IconBolt,
  IconBrandSlack,
  IconCalendarEvent,
  IconCircleFilled,
  IconClock,
  IconFileText,
  IconFolders,
  IconLayoutDashboard,
  IconMail,
  IconMicrophone,
  IconPlayerPause,
  IconPlayerStop,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconTag,
  IconUsers
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import ThemeToggle from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';

import { calendarEvents, meetings, quickAiAnswers, starterTranscript } from './mock-data';
import type { AiAnswer, Meeting, TranscriptLine } from './types';

type View = 'dashboard' | 'live' | 'detail' | 'calendar' | 'settings';

type IconComponent = typeof IconLayoutDashboard;

const SIDEBAR_LINKS: Array<{
  id: View;
  label: string;
  icon: IconComponent;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { id: 'live', label: 'Live Session', icon: IconMicrophone },
  { id: 'calendar', label: 'Calendar', icon: IconCalendarEvent },
  { id: 'settings', label: 'Settings', icon: IconSettings }
];

function priorityVariant(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') return 'destructive';
  if (priority === 'medium') return 'default';
  return 'outline';
}

function createRealtimeLine(nextIndex: number): TranscriptLine {
  const speaker = nextIndex % 2 === 0 ? 'Sarah Chen' : 'Marcus Wong';
  const second = 70 + nextIndex * 12;
  const minutes = Math.floor(second / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (second % 60).toString().padStart(2, '0');

  return {
    id: `t-live-dynamic-${nextIndex}`,
    timestamp: `00:${minutes}:${seconds}`,
    speaker,
    text:
      nextIndex % 2 === 0
        ? 'We should include this milestone in the Q3 launch checklist and track latency daily.'
        : 'Action item captured: prepare release notes and confirm support readiness by Friday.'
  };
}

function createAiAnswer(question: string): AiAnswer {
  const normalized = question.toLowerCase();
  if (normalized.includes('action')) {
    return {
      id: crypto.randomUUID(),
      question,
      answer:
        'Detected action items: Alex to finalize specs by Friday and Sarah to update help center articles by Monday.',
      timestamp: '00:18:45'
    };
  }

  if (normalized.includes('timeline') || normalized.includes('disagree')) {
    return {
      id: crypto.randomUUID(),
      question,
      answer:
        'Sarah raised a timeline concern at 00:02:20 and requested a two-week extension for safer release quality.',
      timestamp: '00:02:20'
    };
  }

  return {
    id: crypto.randomUUID(),
    question,
    answer:
      'Current summary: the team aligned on Q3 priorities, promoted API latency to P0, and confirmed Dark Mode as a launch objective.',
    timestamp: '00:01:02'
  };
}

function AppSidebar({
  activeView,
  onNavigate,
  onStartRecording
}: {
  activeView: View;
  onNavigate: (view: View) => void;
  onStartRecording: () => void;
}) {
  return (
    <aside className='hidden w-60 shrink-0 border-r border-slate-700/60 bg-slate-900/95 p-4 lg:flex lg:flex-col'>
      <div className='rounded-xl border border-slate-700/80 bg-slate-800/70 p-3'>
        <p className='text-sm font-semibold text-slate-100'>John Doe</p>
        <p className='text-xs text-slate-400'>john@company.com</p>
      </div>
      <nav aria-label='Primary navigation' className='mt-4 space-y-1'>
        {SIDEBAR_LINKS.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type='button'
              onClick={() => {
                onNavigate(entry.id);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all',
                activeView === entry.id
                  ? 'bg-blue-600 text-slate-50'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <Icon className='size-4' />
              {entry.label}
            </button>
          );
        })}
      </nav>

      <div className='mt-5'>
        <p className='mb-2 px-2 text-[11px] font-semibold tracking-[0.15em] text-slate-500 uppercase'>
          Recent
        </p>
        <div className='space-y-1'>
          {meetings.slice(0, 3).map((meeting) => (
            <div
              key={meeting.id}
              className='rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800/70'
            >
              {meeting.title}
            </div>
          ))}
        </div>
      </div>

      <Button
        className='mt-auto'
        onClick={() => {
          onStartRecording();
        }}
      >
        <IconMicrophone className='mr-1.5 size-4' />
        New Recording
      </Button>
    </aside>
  );
}

function DashboardScreen({
  filteredMeetings,
  searchText,
  setSearchText,
  onOpenMeeting,
  onStartRecording
}: {
  filteredMeetings: Meeting[];
  searchText: string;
  setSearchText: (value: string) => void;
  onOpenMeeting: (meetingId: string) => void;
  onStartRecording: () => void;
}) {
  return (
    <section className='space-y-5'>
      <div className='flex flex-wrap items-center gap-3'>
        <div className='relative min-w-64 flex-1'>
          <IconSearch className='text-muted-foreground absolute top-2 left-2.5 size-4' />
          <Input
            aria-label='Search all meetings'
            value={searchText}
            onChange={(event) => {
              setSearchText(event.currentTarget.value);
            }}
            className='pl-8'
            placeholder='Search all meetings...'
          />
        </div>
        <Button variant='outline'>Filters</Button>
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button
          onClick={() => {
            onStartRecording();
          }}
        >
          <IconMicrophone className='mr-1.5 size-4' />
          Start New Recording
        </Button>
        <Button variant='outline'>Import Audio</Button>
      </div>

      <div className='space-y-3'>
        <div className='flex items-center gap-2'>
          <IconFolders className='size-4 text-slate-300' />
          <h2 className='text-lg font-semibold text-slate-100'>Recent Meetings</h2>
        </div>
        {filteredMeetings.map((meeting) => (
          <Card
            key={meeting.id}
            className='border-slate-700/80 bg-slate-800/70 transition-transform hover:-translate-y-0.5'
          >
            <CardHeader className='space-y-3'>
              <div className='flex items-center justify-between gap-3'>
                <CardTitle className='text-slate-100'>{meeting.title}</CardTitle>
                <Badge variant={meeting.status === 'live' ? 'default' : 'outline'}>
                  {meeting.status === 'live' ? 'Live' : 'Completed'}
                </Badge>
              </div>
              <div className='flex flex-wrap items-center gap-3 text-xs text-slate-400'>
                <span className='inline-flex items-center gap-1'>
                  <IconClock className='size-3.5' />
                  {meeting.startedAt}
                </span>
                <span>{meeting.duration}</span>
                <span className='inline-flex items-center gap-1'>
                  <IconUsers className='size-3.5' />
                  {meeting.participantCount} participants
                </span>
              </div>
            </CardHeader>
            <CardContent className='space-y-3'>
              <p className='text-sm text-slate-300'>{meeting.summarySnippet}</p>
              <div className='flex flex-wrap gap-1'>
                {meeting.tags.map((tag) => (
                  <Badge key={`${meeting.id}-${tag}`} variant='outline'>
                    #{tag}
                  </Badge>
                ))}
              </div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-xs text-slate-400'>
                  {meeting.actionItems.length} action items • {meeting.decisions.length} decisions
                </p>
                <Button
                  size='sm'
                  onClick={() => {
                    onOpenMeeting(meeting.id);
                  }}
                >
                  Open Meeting
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function LiveScreen({
  elapsedSeconds,
  isRecording,
  transcript,
  askInput,
  setAskInput,
  onAskAi,
  aiAnswers,
  onPauseResume,
  onStop
}: {
  elapsedSeconds: number;
  isRecording: boolean;
  transcript: TranscriptLine[];
  askInput: string;
  setAskInput: (value: string) => void;
  onAskAi: () => void;
  aiAnswers: AiAnswer[];
  onPauseResume: () => void;
  onStop: () => void;
}) {
  const mm = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (elapsedSeconds % 60).toString().padStart(2, '0');

  return (
    <section className='grid gap-4 xl:grid-cols-[1fr_320px]'>
      <Card className='border-slate-700/80 bg-slate-900/80'>
        <CardHeader className='space-y-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='inline-flex items-center gap-2'>
              <IconCircleFilled
                className={cn('size-4 text-red-500', isRecording && 'animate-pulse')}
                aria-hidden='true'
              />
              <p className='text-sm font-semibold text-slate-100'>Recording</p>
            </div>
            <p className='text-sm text-slate-300'>Timer: {mm}:{ss}</p>
          </div>
          <Input defaultValue='Product Sync Meeting' aria-label='Meeting title' />
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='outline' onClick={onPauseResume}>
              <IconPlayerPause className='mr-1.5 size-4' />
              {isRecording ? 'Pause' : 'Resume'}
            </Button>
            <Button variant='destructive' onClick={onStop}>
              <IconPlayerStop className='mr-1.5 size-4' />
              Stop
            </Button>
            <Button variant='secondary'>
              <IconSparkles className='mr-1.5 size-4' />
              Highlight
            </Button>
            <Button variant='secondary'>
              <IconFileText className='mr-1.5 size-4' />
              Note
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-xs font-semibold tracking-[0.15em] text-slate-400 uppercase'>
            Live Transcript
          </p>
          <div aria-live='polite' className='max-h-[420px] space-y-3 overflow-y-auto pr-2'>
            {transcript.map((line) => (
              <div key={line.id} className='rounded-lg border border-slate-700/70 bg-slate-800/70 p-3'>
                <p className='mb-1 text-xs font-medium text-slate-400'>
                  [{line.timestamp}] {line.speaker}
                  {line.highlighted ? '  ⭐' : ''}
                </p>
                <p className='text-sm text-slate-200'>{line.text}</p>
              </div>
            ))}
          </div>
          <div className='flex items-center gap-2'>
            <Input
              aria-label='Ask AI about live meeting'
              placeholder='What did Sarah say about mobile?'
              value={askInput}
              onChange={(event) => {
                setAskInput(event.currentTarget.value);
              }}
            />
            <Button
              size='icon'
              onClick={() => {
                onAskAi();
              }}
            >
              <IconArrowUp className='size-4' />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className='border-slate-700/80 bg-slate-900/80'>
        <CardHeader>
          <CardTitle className='text-slate-100'>Live Intelligence</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-slate-400 uppercase'>Summary</p>
            <p className='mt-1 text-sm text-slate-300'>
              Team is discussing Q3 priorities with focus on Dark Mode, API latency, and mobile
              performance.
            </p>
          </div>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-slate-400 uppercase'>Key Decisions</p>
            <p className='mt-1 text-sm text-slate-300'>
              API latency is now P0 priority for the sprint.
            </p>
          </div>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-slate-400 uppercase'>Action Items</p>
            <p className='mt-1 text-sm text-slate-300'>None detected yet during this live segment.</p>
          </div>
          <div className='space-y-2 border-t border-slate-700/70 pt-3'>
            <p className='text-xs font-semibold tracking-[0.15em] text-slate-400 uppercase'>Ask Responses</p>
            {aiAnswers.slice(0, 2).map((answer) => (
              <div key={answer.id} className='rounded-md border border-slate-700/70 bg-slate-800/70 p-2'>
                <p className='text-xs text-slate-400'>{answer.question}</p>
                <p className='text-sm text-slate-200'>{answer.answer}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function DetailScreen({
  meeting,
  aiAnswers,
  setView
}: {
  meeting: Meeting;
  aiAnswers: AiAnswer[];
  setView: (view: View) => void;
}) {
  return (
    <section className='grid gap-4 xl:grid-cols-[1fr_320px]'>
      <Card className='border-slate-700/80 bg-slate-900/80 xl:col-span-2'>
        <CardHeader className='space-y-3'>
          <button
            type='button'
            onClick={() => {
              setView('dashboard');
            }}
            className='text-left text-xs text-slate-400 hover:text-slate-200'
          >
            ← Back to Dashboard
          </button>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <CardTitle className='text-xl text-slate-100'>{meeting.title}</CardTitle>
            <div className='flex flex-wrap gap-2'>
              <Button size='sm' variant='outline'>
                Share
              </Button>
              <Button size='sm' variant='outline'>
                Export
              </Button>
              <Button size='sm' variant='outline'>
                Email
              </Button>
              <Button size='sm' variant='outline'>
                Slack
              </Button>
            </div>
          </div>
          <p className='text-sm text-slate-400'>
            {meeting.startedAt} • {meeting.duration} • {meeting.participantCount} participants
          </p>
          <div className='flex flex-wrap gap-1'>
            {meeting.tags.map((tag) => (
              <Badge key={`detail-${tag}`} variant='outline'>
                #{tag}
              </Badge>
            ))}
            <Button size='sm' variant='ghost' className='text-slate-300'>
              <IconTag className='mr-1 size-4' />
              Add tag
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card className='border-slate-700/80 bg-slate-900/80'>
        <CardContent>
          <Tabs defaultValue='summary' className='w-full'>
            <TabsList variant='line' className='mb-4 w-full justify-start'>
              <TabsTrigger value='summary'>Summary</TabsTrigger>
              <TabsTrigger value='transcript'>Transcript</TabsTrigger>
              <TabsTrigger value='actions'>Action Items</TabsTrigger>
              <TabsTrigger value='notes'>Notes</TabsTrigger>
              <TabsTrigger value='chat'>AI Chat</TabsTrigger>
            </TabsList>
            <TabsContent value='summary' className='space-y-3'>
              <div>
                <h3 className='text-sm font-semibold text-slate-100'>Executive Summary</h3>
                <p className='text-sm text-slate-300'>{meeting.aiSummary}</p>
              </div>
              <div>
                <h3 className='text-sm font-semibold text-slate-100'>Key Decisions</h3>
                <ul className='list-inside list-disc space-y-1 text-sm text-slate-300'>
                  {meeting.decisions.map((decision) => (
                    <li key={decision}>{decision}</li>
                  ))}
                </ul>
              </div>
            </TabsContent>
            <TabsContent value='transcript' className='space-y-2'>
              {meeting.transcript.map((line) => (
                <div key={line.id} className='rounded-md border border-slate-700/60 p-2'>
                  <p className='text-xs text-slate-400'>
                    [{line.timestamp}] {line.speaker}
                  </p>
                  <p className='text-sm text-slate-200'>{line.text}</p>
                </div>
              ))}
            </TabsContent>
            <TabsContent value='actions' className='space-y-2'>
              {meeting.actionItems.map((item) => (
                <div key={item.id} className='rounded-md border border-slate-700/60 p-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                    <p className='text-xs text-slate-400'>{item.timestamp}</p>
                  </div>
                  <p className='mt-1 text-sm text-slate-200'>
                    @{item.assignee} - {item.task}
                  </p>
                </div>
              ))}
            </TabsContent>
            <TabsContent value='notes'>
              <Textarea defaultValue={meeting.notes} rows={7} />
            </TabsContent>
            <TabsContent value='chat' className='space-y-2'>
              {aiAnswers.map((answer) => (
                <div key={answer.id} className='rounded-md border border-slate-700/60 p-2'>
                  <p className='text-xs text-slate-400'>{answer.question}</p>
                  <p className='text-sm text-slate-200'>{answer.answer}</p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className='border-slate-700/80 bg-slate-900/80'>
        <CardHeader>
          <CardTitle className='text-slate-100'>AI Insights</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-slate-400 uppercase'>Action Items</p>
            {meeting.actionItems.map((item) => (
              <p key={`insight-${item.id}`} className='mt-1 text-sm text-slate-300'>
                @{item.assignee} - {item.task} ({item.timestamp})
              </p>
            ))}
          </div>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-slate-400 uppercase'>Quick Stats</p>
            <p className='mt-1 text-sm text-slate-300'>Speaking time: John 45%, Sarah 30%, Marcus 25%</p>
            <p className='text-sm text-slate-300'>Total sentences: 248 • Avg speed: 145 words/min</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function CalendarScreen() {
  return (
    <section className='space-y-4'>
      <Card className='border-slate-700/80 bg-slate-900/80'>
        <CardHeader className='flex-row items-center justify-between'>
          <CardTitle className='text-slate-100'>Google Calendar</CardTitle>
          <Badge>Connected</Badge>
        </CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-sm text-slate-300'>john@company.com</p>
          <div className='space-y-2'>
            {calendarEvents.map((event) => (
              <div key={event.id} className='rounded-lg border border-slate-700/70 bg-slate-800/70 p-3'>
                <p className='text-sm font-semibold text-slate-100'>{event.title}</p>
                <p className='text-xs text-slate-400'>{event.time}</p>
                <p className='text-xs text-slate-400'>{event.location}</p>
                <p className='mt-2 text-xs text-slate-300'>{event.note}</p>
                <div className='mt-2 flex gap-2'>
                  <Button size='sm' variant='outline'>
                    Start Recording
                  </Button>
                  {event.recurring ? (
                    <Button size='sm' variant='ghost'>
                      Auto-Record
                    </Button>
                  ) : (
                    <Button size='sm' variant='ghost'>
                      Set Reminder
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function SettingsScreen() {
  return (
    <section className='space-y-4'>
      <Tabs defaultValue='integrations'>
        <TabsList className='bg-slate-800/80'>
          <TabsTrigger value='general'>General</TabsTrigger>
          <TabsTrigger value='audio'>Audio</TabsTrigger>
          <TabsTrigger value='ai'>AI Preferences</TabsTrigger>
          <TabsTrigger value='integrations'>Integrations</TabsTrigger>
          <TabsTrigger value='privacy'>Privacy</TabsTrigger>
        </TabsList>
        <TabsContent value='general'>
          <Card className='border-slate-700/80 bg-slate-900/80'>
            <CardContent className='space-y-2'>
              <p className='text-sm text-slate-300'>Language: English</p>
              <p className='text-sm text-slate-300'>Time format: 12h</p>
              <p className='text-sm text-slate-300'>Theme control available in top-right toggle.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value='audio'>
          <Card className='border-slate-700/80 bg-slate-900/80'>
            <CardContent className='space-y-2'>
              <p className='text-sm text-slate-300'>Input device: MacBook Microphone</p>
              <p className='text-sm text-slate-300'>Noise suppression: Enabled</p>
              <p className='text-sm text-slate-300'>Echo cancellation: Enabled</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value='ai'>
          <Card className='border-slate-700/80 bg-slate-900/80'>
            <CardContent className='space-y-2'>
              <p className='text-sm text-slate-300'>Summary length: Detailed</p>
              <p className='text-sm text-slate-300'>Action item sensitivity: Balanced</p>
              <p className='text-sm text-slate-300'>Response style: Explanatory</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value='integrations'>
          <div className='space-y-3'>
            <Card className='border-slate-700/80 bg-slate-900/80'>
              <CardHeader className='flex-row items-center justify-between'>
                <CardTitle className='text-slate-100'>
                  <IconMail className='mr-2 inline size-4' />
                  Gmail
                </CardTitle>
                <Badge>Connected</Badge>
              </CardHeader>
              <CardContent className='space-y-1 text-sm text-slate-300'>
                <p>Auto-generate follow-up emails</p>
                <p>Include transcript attachment</p>
                <p>Smart recipient detection</p>
              </CardContent>
            </Card>
            <Card className='border-slate-700/80 bg-slate-900/80'>
              <CardHeader className='flex-row items-center justify-between'>
                <CardTitle className='text-slate-100'>
                  <IconBrandSlack className='mr-2 inline size-4' />
                  Slack
                </CardTitle>
                <Badge>Connected</Badge>
              </CardHeader>
              <CardContent className='space-y-1 text-sm text-slate-300'>
                <p>Default channel: #product-team</p>
                <p>Summary schedule: End of day (6:00 PM)</p>
                <p>Thread summaries by meeting</p>
              </CardContent>
            </Card>
            <Card className='border-slate-700/80 bg-slate-900/80'>
              <CardHeader className='flex-row items-center justify-between'>
                <CardTitle className='text-slate-100'>
                  <IconCalendarEvent className='mr-2 inline size-4' />
                  Google Calendar
                </CardTitle>
                <Badge>Connected</Badge>
              </CardHeader>
              <CardContent className='space-y-1 text-sm text-slate-300'>
                <p>Show upcoming meetings in app</p>
                <p>Pre-meeting reminders: 5 minutes</p>
                <p>Sync frequency: Every 15 minutes</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value='privacy'>
          <Card className='border-slate-700/80 bg-slate-900/80'>
            <CardContent className='space-y-2'>
              <p className='text-sm text-slate-300'>Data retention: 90 days</p>
              <p className='text-sm text-slate-300'>Auto-delete old meetings: Off</p>
              <p className='text-sm text-slate-300'>Export all data available from dashboard exports.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function FloatingWidget({
  isRecording,
  elapsedSeconds,
  onPauseResume,
  onStop,
  onAsk
}: {
  isRecording: boolean;
  elapsedSeconds: number;
  onPauseResume: () => void;
  onStop: () => void;
  onAsk: () => void;
}) {
  if (!isRecording) return null;

  const mm = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (elapsedSeconds % 60).toString().padStart(2, '0');

  return (
    <div className='fixed right-4 bottom-4 z-40 w-80 rounded-xl border border-slate-600 bg-slate-900/85 p-3 shadow-2xl backdrop-blur'>
      <p className='mb-1 text-sm font-semibold text-slate-100'>AI Meeting Copilot</p>
      <p className='text-sm text-slate-200'>🔴 Recording {mm}:{ss}</p>
      <p className='mt-1 text-xs text-slate-400'>Product Sync Meeting</p>
      <div className='mt-2 flex gap-2'>
        <Button size='sm' variant='outline' onClick={onAsk}>
          Ask AI
        </Button>
        <Button size='sm' variant='outline' onClick={onPauseResume}>
          <IconPlayerPause className='mr-1.5 size-3.5' />
          Pause
        </Button>
        <Button size='sm' variant='destructive' onClick={onStop}>
          <IconPlayerStop className='mr-1.5 size-3.5' />
          Stop
        </Button>
      </div>
    </div>
  );
}

export default function MeetingCopilotApp() {
  const fallbackMeeting = meetings[0];
  if (!fallbackMeeting) {
    throw new Error('No meeting seed data configured.');
  }

  const [view, setView] = useState<View>('dashboard');
  const [selectedMeetingId, setSelectedMeetingId] = useState(fallbackMeeting.id);
  const [searchText, setSearchText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(764);
  const [liveTranscript, setLiveTranscript] = useState<TranscriptLine[]>(starterTranscript);
  const [askInput, setAskInput] = useState('');
  const [aiAnswers, setAiAnswers] = useState<AiAnswer[]>(quickAiAnswers);

  useEffect(() => {
    if (!isRecording) return;

    const timerId = globalThis.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => {
      globalThis.clearInterval(timerId);
    };
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) return;

    const transcriptInterval = globalThis.setInterval(() => {
      setLiveTranscript((current) => {
        if (current.length > 10) return current;
        return [...current, createRealtimeLine(current.length + 1)];
      });
    }, 7000);

    return () => {
      globalThis.clearInterval(transcriptInterval);
    };
  }, [isRecording]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const withCommand = event.metaKey || event.ctrlKey;

      if (withCommand && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setView('live');
        setIsRecording(true);
      }

      if (withCommand && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setView('dashboard');
      }

      if (withCommand && event.key === '/') {
        event.preventDefault();
        setView('dashboard');
      }

      if (withCommand && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setView('live');
      }

      if (event.code === 'Space' && view === 'live') {
        event.preventDefault();
        setIsRecording((current) => !current);
      }
    };

    globalThis.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, [view]);

  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedMeetingId) ?? fallbackMeeting,
    [fallbackMeeting, selectedMeetingId]
  );

  const filteredMeetings = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return meetings;

    return meetings.filter((meeting) => {
      const searchable = [
        meeting.title,
        meeting.summarySnippet,
        ...meeting.tags,
        ...meeting.decisions
      ].join(' ');

      return searchable.toLowerCase().includes(query);
    });
  }, [searchText]);

  const askAi = () => {
    if (!askInput.trim()) return;
    const answer = createAiAnswer(askInput);
    setAiAnswers((current) => [answer, ...current]);
    setAskInput('');
  };

  const startRecording = () => {
    setView('live');
    setIsRecording(true);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setView('detail');
  };

  const pauseResumeRecording = () => {
    setIsRecording((current) => !current);
  };

  return (
    <div className='min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100'>
      <div className='mx-auto flex min-h-dvh max-w-[1800px]'>
        <AppSidebar activeView={view} onNavigate={setView} onStartRecording={startRecording} />
        <div className='flex min-h-dvh flex-1 flex-col'>
          <header className='sticky top-0 z-20 border-b border-slate-700/60 bg-slate-900/85 backdrop-blur'>
            <div className='flex items-center justify-between px-5 py-4'>
              <div>
                <h1 className='text-lg font-semibold'>AI Meeting Copilot</h1>
                <p className='text-xs text-slate-400'>
                  Real-time transcription, intelligence, and meeting follow-up automation.
                </p>
              </div>
              <div className='flex items-center gap-3'>
                <Badge variant='outline' className='border-cyan-500/60 text-cyan-300'>
                  <IconBolt className='mr-1 size-3.5' />
                  Live AI
                </Badge>
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className='flex-1 p-4 md:p-6'>
            {view === 'dashboard' && (
              <DashboardScreen
                filteredMeetings={filteredMeetings}
                searchText={searchText}
                setSearchText={setSearchText}
                onOpenMeeting={(meetingId) => {
                  setSelectedMeetingId(meetingId);
                  setView('detail');
                }}
                onStartRecording={startRecording}
              />
            )}
            {view === 'live' && (
              <LiveScreen
                elapsedSeconds={elapsedSeconds}
                isRecording={isRecording}
                transcript={liveTranscript}
                askInput={askInput}
                setAskInput={setAskInput}
                onAskAi={askAi}
                aiAnswers={aiAnswers}
                onPauseResume={pauseResumeRecording}
                onStop={stopRecording}
              />
            )}
            {view === 'detail' && (
              <DetailScreen meeting={selectedMeeting} aiAnswers={aiAnswers} setView={setView} />
            )}
            {view === 'calendar' && <CalendarScreen />}
            {view === 'settings' && <SettingsScreen />}
          </main>
        </div>
      </div>
      <FloatingWidget
        isRecording={isRecording}
        elapsedSeconds={elapsedSeconds}
        onPauseResume={pauseResumeRecording}
        onStop={stopRecording}
        onAsk={() => {
          setView('live');
        }}
      />
    </div>
  );
}
