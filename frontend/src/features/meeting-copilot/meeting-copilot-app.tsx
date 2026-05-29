import { useEffect, useMemo, useState } from 'react';

import {
  IconArrowUp,
  IconArrowUpRight,
  IconBolt,
  IconCalendarEvent,
  IconCircleFilled,
  IconClock,
  IconFileText,
  IconFolders,
  IconInfoCircle,
  IconHeadphones,
  IconLayoutDashboard,
  IconMicrophone,
  IconMicrophone2,
  IconLogout,
  IconPlayerPause,
  IconPlayerStop,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconUsers
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import ThemeToggle from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { UserProfile } from '@/components/user-profile';

import { askMeetingQuestion } from './api';
import {
  queryWebMicrophone,
  requestDesktopMicrophone,
  requestWebMicrophone
} from './permissions';
import SettingsScreen from './settings-screen';
import {
  COPILOT_BTN_OUTLINE,
  COPILOT_HIGHLIGHT_PANEL,
  COPILOT_INNER_PANEL,
  COPILOT_INPUT,
  COPILOT_SURFACE
} from './copilot-styles';
import './copilot-theme.css';
import CalendarScreen from './calendar-screen';
import DeviceCheckScreen, { type DeviceCheckTab } from './device-check-screen';
import MeetingDetailScreen from './meeting-detail/meeting-detail-screen';
import { meetings, quickAiAnswers, starterTranscript } from './mock-data';
import type { AiAnswer, Meeting, TranscriptLine } from './types';

type View = 'dashboard' | 'live' | 'detail' | 'calendar' | 'device-check' | 'settings';
type RuntimeMode = 'web' | 'desktop';

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

const DEVICE_CHECK_LINKS: Array<{
  tab: DeviceCheckTab;
  label: string;
  icon: IconComponent;
}> = [
  { tab: 'microphone', label: 'Microphone Test', icon: IconMicrophone2 },
  { tab: 'system-audio', label: 'System Audio Test', icon: IconHeadphones }
];

const QUICK_ASK_PROMPTS = [
  'Who mentioned pricing discussion?',
  'What are my action items?',
  'Did anyone disagree with the timeline?'
] as const;

const SURFACE = COPILOT_SURFACE;

const PAGE_META: Record<View, { title: string; description: string }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'Real-time transcription, intelligence, and meeting follow-up automation.'
  },
  live: {
    title: 'Live Session',
    description: 'Capture, transcribe, and ask AI questions during an active meeting.'
  },
  detail: {
    title: 'Meeting Detail',
    description: 'Review summaries, transcripts, action items, and AI insights.'
  },
  calendar: {
    title: 'Calendar',
    description: 'Upcoming meetings and recording controls from your calendar.'
  },
  'device-check': {
    title: 'Device Check',
    description:
      'Validate microphone input and system audio capture before joining or starting a meeting.'
  },
  settings: {
    title: 'Settings',
    description: 'Configure audio, AI preferences, integrations, and privacy.'
  }
};

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

function AppSidebar({
  activeView,
  deviceCheckTab,
  onNavigate,
  onDeviceCheckTab,
  onStartRecording,
  selectedMeeting
}: {
  activeView: View;
  deviceCheckTab: DeviceCheckTab;
  onNavigate: (view: View) => void;
  onDeviceCheckTab: (tab: DeviceCheckTab) => void;
  onStartRecording: () => void;
  selectedMeeting: Meeting;
}) {
  const { user, logout } = useAuth();
  return (
    <aside className='sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-border bg-sidebar p-4 text-sidebar-foreground lg:flex'>
      <div className='mb-3 inline-flex items-center gap-3 rounded-xl border border-primary/30 bg-card px-3 py-2'>
        <div className='inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1E3A8A] via-[#3B82F6] to-[#06B6D4] text-white'>
          <IconBolt className='size-4' />
        </div>
        <div>
          <p className='text-sm font-semibold text-foreground'>Speller.ai</p>
          <p className='text-[11px] text-muted-foreground'>AI Meeting Copilot</p>
        </div>
      </div>

      <div className='rounded-xl border border-border bg-muted/40 p-3'>
        <p className='text-sm font-semibold text-foreground'>{user?.name || 'User'}</p>
        <p className='text-xs text-muted-foreground'>{user?.email || '—'}</p>
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
                'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-all duration-200',
                activeView === entry.id
                  ? 'bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white shadow-[0_8px_24px_rgba(59,130,246,0.35)]'
                  : 'text-muted-foreground hover:bg-[var(--copilot-nav-hover)] hover:text-foreground'
              )}
            >
              <Icon className='size-4' />
              {entry.label}
            </button>
          );
        })}
      </nav>

      <div className='mt-5'>
        <p className='mb-2 px-2 text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase'>
          Device Check
        </p>
        <div className='space-y-1'>
          {DEVICE_CHECK_LINKS.map((entry) => {
            const Icon = entry.icon;
            const isActive = activeView === 'device-check' && deviceCheckTab === entry.tab;
            return (
              <button
                key={entry.tab}
                type='button'
                onClick={() => {
                  onDeviceCheckTab(entry.tab);
                  onNavigate('device-check');
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white shadow-[0_8px_24px_rgba(59,130,246,0.35)]'
                    : 'text-muted-foreground hover:bg-[var(--copilot-nav-hover)] hover:text-foreground'
                )}
              >
                <Icon className='size-4' />
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className='mt-5'>
        <p className='mb-2 px-2 text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase'>
          Recent
        </p>
        <div className='space-y-1'>
          {meetings.slice(0, 3).map((meeting) => (
            <div
              key={meeting.id}
              className='rounded-lg border border-transparent px-2 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/60'
            >
              {meeting.title}
            </div>
          ))}
        </div>
      </div>

      <div className='mt-4 rounded-xl border border-border bg-muted/40 p-3'>
        <p className='text-[11px] text-muted-foreground'>Active meeting</p>
        <p className='text-sm font-medium text-foreground'>{selectedMeeting.title}</p>
        <p className='mt-1 text-xs text-muted-foreground'>{selectedMeeting.duration}</p>
      </div>

      <Button
        className='mt-auto bg-gradient-to-r from-[#1E3A8A] via-[#3B82F6] to-[#06B6D4] text-white hover:opacity-95'
        onClick={() => {
          onStartRecording();
        }}
      >
        <IconMicrophone className='mr-1.5 size-4' />
        New Recording
      </Button>

      <Button
        variant='outline'
        className='mt-2 rounded-xl border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted'
        onClick={() => {
          logout();
        }}
      >
        <IconLogout className='mr-1.5 size-4' />
        Logout
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
  const statCards = [
    { label: 'Documents', value: '1,247', trend: '+12% from last month' },
    { label: 'Words Analyzed', value: '2.4M', trend: '+18% from last month' },
    { label: 'Accuracy Score', value: '98.5%', trend: '+2.1% improvement' },
    { label: 'Time Saved', value: '156h', trend: '+20h from last month' }
  ];

  return (
    <section className='space-y-5'>
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
        {statCards.map((stat) => (
          <Card key={stat.label} className={SURFACE}>
            <CardContent className='space-y-1'>
              <p className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>{stat.label}</p>
              <p className='text-2xl font-semibold text-foreground'>{stat.value}</p>
              <p className='text-xs text-[#06B6D4]'>{stat.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='flex flex-wrap items-center gap-3'>
        <div className='relative min-w-64 flex-1'>
          <IconSearch className='absolute top-2 left-2.5 size-4 text-muted-foreground' />
          <Input
            aria-label='Search all meetings'
            value={searchText}
            onChange={(event) => {
              setSearchText(event.currentTarget.value);
            }}
            className={cn(COPILOT_INPUT, 'bg-muted/70 pl-8')}
            placeholder='Search all meetings...'
          />
        </div>
        <Button variant='outline' className={COPILOT_BTN_OUTLINE}>
          Filters
        </Button>
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button
          className='bg-gradient-to-r from-[#1E3A8A] via-[#3B82F6] to-[#06B6D4] text-white'
          onClick={() => {
            onStartRecording();
          }}
        >
          <IconMicrophone className='mr-1.5 size-4' />
          Start New Recording
        </Button>
        <Button variant='outline' className={COPILOT_BTN_OUTLINE}>
          Import Audio
        </Button>
      </div>

      <div className='space-y-3'>
        <div className='flex items-center gap-2'>
          <IconFolders className='size-4 text-muted-foreground' />
          <h2 className='text-lg font-semibold text-foreground'>Recent Meetings</h2>
        </div>
        {filteredMeetings.map((meeting) => (
          <Card key={meeting.id} className={cn(SURFACE, 'transition-all hover:-translate-y-0.5 hover:border-[#3B82F6]/60')}>
            <CardHeader className='space-y-3'>
              <div className='flex items-center justify-between gap-3'>
                <CardTitle className='text-foreground'>{meeting.title}</CardTitle>
                <Badge
                  variant={meeting.status === 'live' ? 'default' : 'outline'}
                  className={cn(
                    meeting.status === 'live' && 'bg-[#EF4444] text-white',
                    meeting.status !== 'live' && 'border-border text-muted-foreground'
                  )}
                >
                  {meeting.status === 'live' ? 'Live' : 'Completed'}
                </Badge>
              </div>
              <div className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
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
              <p className='text-sm text-foreground/80'>{meeting.summarySnippet}</p>
              <div className='flex flex-wrap gap-1'>
                {meeting.tags.map((tag) => (
                  <Badge
                    key={`${meeting.id}-${tag}`}
                    variant='outline'
                    className='border-border bg-muted/70 text-muted-foreground'
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-xs text-muted-foreground'>
                  {meeting.actionItems.length} action items • {meeting.decisions.length} decisions
                </p>
                <Button
                  size='sm'
                  className='bg-primary text-primary-foreground hover:bg-primary/90'
                  onClick={() => {
                    onOpenMeeting(meeting.id);
                  }}
                >
                  Open Meeting
                  <IconArrowUpRight className='ml-1 size-3.5' />
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
  isPaused,
  transcript,
  askInput,
  setAskInput,
  onAskAi,
  aiAnswers,
  isAsking,
  askError,
  onPauseResume,
  onStop
}: {
  elapsedSeconds: number;
  isRecording: boolean;
  isPaused: boolean;
  transcript: TranscriptLine[];
  askInput: string;
  setAskInput: (value: string) => void;
  onAskAi: (question?: string) => Promise<void>;
  aiAnswers: AiAnswer[];
  isAsking: boolean;
  askError: string | null;
  onPauseResume: () => void;
  onStop: () => void;
}) {
  const mm = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (elapsedSeconds % 60).toString().padStart(2, '0');

  return (
    <section className='grid gap-4 xl:grid-cols-[1fr_320px]'>
      <Card className={SURFACE}>
        <CardHeader className='space-y-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='inline-flex items-center gap-2'>
              <IconCircleFilled
                className={cn('size-4 text-red-500', isRecording && 'animate-pulse')}
                aria-hidden='true'
              />
              <p className='text-sm font-semibold text-foreground'>Recording</p>
            </div>
            <p className='text-sm text-foreground/80'>Timer: {mm}:{ss}</p>
          </div>
          <Input
            defaultValue='Product Sync Meeting'
            aria-label='Meeting title'
            className={COPILOT_INPUT}
          />
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='outline' className='border-border text-foreground' onClick={onPauseResume}>
              <IconPlayerPause className='mr-1.5 size-4' />
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant='destructive' onClick={onStop}>
              <IconPlayerStop className='mr-1.5 size-4' />
              Stop
            </Button>
            <Button variant='secondary' className='bg-[#1E3A8A]/30 text-foreground/85 hover:bg-[#1E3A8A]/50'>
              <IconSparkles className='mr-1.5 size-4' />
              Highlight
            </Button>
            <Button variant='secondary' className='bg-[#1E3A8A]/30 text-foreground/85 hover:bg-[#1E3A8A]/50'>
              <IconFileText className='mr-1.5 size-4' />
              Note
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase'>
            Live Transcript
          </p>
          <div aria-live='polite' className='max-h-[420px] space-y-3 overflow-y-auto pr-2'>
            {transcript.map((line) => (
              <div
                key={line.id}
                className={cn(
                  'rounded-lg border p-3',
                  line.highlighted ? COPILOT_HIGHLIGHT_PANEL : COPILOT_INNER_PANEL
                )}
              >
                <p className='mb-1 text-xs font-medium text-muted-foreground'>
                  [{line.timestamp}] {line.speaker}
                  {line.highlighted ? '  ⭐' : ''}
                </p>
                <p className='text-sm text-foreground/85'>{line.text}</p>
              </div>
            ))}
          </div>
          <form
            className='space-y-2'
            onSubmit={async (event) => {
              event.preventDefault();
              await onAskAi();
            }}
          >
            <div className='flex items-center gap-2'>
              <Input
                aria-label='Ask AI about live meeting'
                placeholder='What did Sarah say about mobile?'
                value={askInput}
                onChange={(event) => {
                  setAskInput(event.currentTarget.value);
                }}
                className={COPILOT_INPUT}
              />
              <Button size='icon' type='submit' disabled={isAsking} className='bg-primary text-primary-foreground'>
                <IconArrowUp className='size-4' />
              </Button>
            </div>
            <div className='flex flex-wrap gap-2'>
              {QUICK_ASK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type='button'
                  className='rounded-full border border-border bg-muted/70 px-3 py-1 text-xs text-foreground/80 hover:border-[#3B82F6]'
                  onClick={async () => {
                    await onAskAi(prompt);
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
            {isAsking && (
              <p className='inline-flex items-center gap-1 text-xs text-[#06B6D4]'>
                <span className='inline-block size-2 animate-pulse rounded-full bg-[#06B6D4]' />
                AI is analyzing the meeting context...
              </p>
            )}
            {askError && (
              <p className='inline-flex items-center gap-1 text-xs text-[#F59E0B]'>
                <IconInfoCircle className='size-3.5' />
                {askError}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className={SURFACE}>
        <CardHeader>
          <CardTitle className='text-foreground'>Live Intelligence</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase'>Summary</p>
            <p className='mt-1 text-sm text-foreground/80'>
              Team is discussing Q3 priorities with focus on Dark Mode, API latency, and mobile
              performance.
            </p>
          </div>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase'>Key Decisions</p>
            <p className='mt-1 text-sm text-foreground/80'>
              API latency is now P0 priority for the sprint.
            </p>
          </div>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase'>Action Items</p>
            <p className='mt-1 text-sm text-foreground/80'>None detected yet during this live segment.</p>
          </div>
          <div className='space-y-2 border-t border-border/70 pt-3'>
            <p className='text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase'>Ask Responses</p>
            {aiAnswers.slice(0, 2).map((answer) => (
              <div key={answer.id} className='rounded-md border border-border/70 bg-muted/70 p-2'>
                <p className='text-xs text-muted-foreground'>{answer.question}</p>
                <p className='text-sm text-foreground/85'>{answer.answer}</p>
                <p className='text-xs text-[#06B6D4]'>Timestamp: {answer.timestamp}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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
    <div className={cn('fixed right-4 bottom-4 z-40 w-80 p-3', SURFACE)}>
      <p className='mb-1 text-sm font-semibold text-foreground'>AI Meeting Copilot</p>
      <p className='text-sm text-foreground/85'>🔴 Recording {mm}:{ss}</p>
      <p className='mt-1 text-xs text-muted-foreground'>Product Sync Meeting</p>
      <div className='mt-2 flex gap-2'>
        <Button size='sm' variant='outline' className='border-primary/50 text-primary' onClick={onAsk}>
          Ask AI
        </Button>
        <Button size='sm' variant='outline' className={COPILOT_BTN_OUTLINE} onClick={onPauseResume}>
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
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(764);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('web');
  const [desktopPlatform, setDesktopPlatform] = useState<string | null>(null);
  const [deviceCheckTab, setDeviceCheckTab] = useState<DeviceCheckTab>('microphone');
  const [liveTranscript, setLiveTranscript] = useState<TranscriptLine[]>(starterTranscript);
  const [askInput, setAskInput] = useState('');
  const [detailAskInput, setDetailAskInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [aiAnswers, setAiAnswers] = useState<AiAnswer[]>(quickAiAnswers);

  useEffect(() => {
    const desktopApi = globalThis.window.desktop;
    if (!desktopApi) return;

    setRuntimeMode('desktop');
    void desktopApi.app
      .getInfo()
      .then((info) => {
        setDesktopPlatform(info.platform);
      })
      .catch(() => {
        setDesktopPlatform(null);
      });

    void desktopApi.recording
      .getStatus()
      .then((state) => {
        setIsRecording(state.isRecording);
        setIsRecordingPaused(state.isPaused);
        setElapsedSeconds(state.elapsedSeconds);
      })
      .catch(() => undefined);

    const unsubscribeState = desktopApi.recording.onStateChange((state) => {
      setIsRecording(state.isRecording);
      setIsRecordingPaused(state.isPaused);
      setElapsedSeconds(state.elapsedSeconds);
    });

    const unsubscribeTranscript = desktopApi.recording.onTranscript((line) => {
      setLiveTranscript((current) => [...current, line]);
    });

    return () => {
      unsubscribeState();
      unsubscribeTranscript();
    };
  }, []);

  useEffect(() => {
    if (!isRecording || isRecordingPaused || runtimeMode === 'desktop') return;

    const timerId = globalThis.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => {
      globalThis.clearInterval(timerId);
    };
  }, [isRecording, isRecordingPaused, runtimeMode]);

  useEffect(() => {
    if (!isRecording || isRecordingPaused || runtimeMode === 'desktop') return;

    const transcriptInterval = globalThis.setInterval(() => {
      setLiveTranscript((current) => {
        if (current.length > 10) return current;
        return [...current, createRealtimeLine(current.length + 1)];
      });
    }, 7000);

    return () => {
      globalThis.clearInterval(transcriptInterval);
    };
  }, [isRecording, isRecordingPaused, runtimeMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const withCommand = event.metaKey || event.ctrlKey;

      if (withCommand && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        startRecording();
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
        pauseResumeRecording();
      }
    };

    globalThis.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, [view, runtimeMode]);

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

  const askAi = async (questionOverride?: string) => {
    const question = (questionOverride ?? askInput).trim();
    if (!question || isAsking) return;

    setIsAsking(true);
    setAskError(null);

    try {
      const response = await askMeetingQuestion({
        meetingId: selectedMeeting.id,
        question,
        transcript: view === 'live' ? liveTranscript : selectedMeeting.transcript,
        actionItems: selectedMeeting.actionItems
      });

      const answer: AiAnswer = {
        id: crypto.randomUUID(),
        question,
        answer:
          response.provider === 'fallback'
            ? `${response.answer} (local fallback)`
            : response.answer,
        timestamp: response.timestamp
      };
      setAiAnswers((current) => [answer, ...current]);
      if (!questionOverride) {
        setAskInput('');
      }
    } catch {
      setAskError('Ask AI is temporarily unavailable. Please retry.');
    } finally {
      setIsAsking(false);
    }
  };

  const startRecording = () => {
    setView('live');
    setAskError(null);
    setIsRecordingPaused(false);

    const beginSession = () => {
      const desktopApi = globalThis.window.desktop;
      if (runtimeMode === 'desktop' && desktopApi) {
        void desktopApi.recording
          .start()
          .then((state) => {
            if (state.blockedReason === 'microphone') {
              setAskError(
                'Microphone access is required. Open Settings → General → Permissions to enable it.'
              );
              setView('settings');
              return;
            }

            if (state.blockedReason === 'systemAudio') {
              setAskError(
                'System audio recording is required. Open Settings → General → Permissions and follow the steps for System audio recording.'
              );
              setView('settings');
              return;
            }

            setIsRecording(state.isRecording);
            setIsRecordingPaused(state.isPaused);
            setElapsedSeconds(state.elapsedSeconds);
          })
          .catch(() => {
            setAskError('Desktop recording service unavailable; switched to web simulation.');
            setRuntimeMode('web');
            setIsRecording(true);
          });
        return;
      }

      setIsRecording(true);
    };

    void (async () => {
      if (runtimeMode === 'desktop' && globalThis.window.desktop?.permissions) {
        const mic = await requestDesktopMicrophone();
        if (!mic?.granted) {
          setAskError(
            'Microphone access is required to record. Enable it in Settings → General → Permissions.'
          );
          setView('settings');
          return;
        }
        beginSession();
        return;
      }

      const webMic = await queryWebMicrophone();
      if (!webMic.granted) {
        const requested = await requestWebMicrophone();
        if (!requested.granted) {
          setAskError('Microphone access was denied. Enable it in your browser site settings.');
          setView('settings');
          return;
        }
      }

      beginSession();
    })();
  };

  const stopRecording = () => {
    const desktopApi = globalThis.window.desktop;
    if (runtimeMode === 'desktop' && desktopApi) {
      void desktopApi.recording
        .stop()
        .then((state) => {
          setIsRecording(state.isRecording);
          setIsRecordingPaused(state.isPaused);
          setElapsedSeconds(state.elapsedSeconds);
          setView('detail');
        })
        .catch(() => {
          setAskError('Desktop stop command failed.');
        });
      return;
    }

    setIsRecording(false);
    setIsRecordingPaused(false);
    setView('detail');
  };

  const pauseResumeRecording = () => {
    const desktopApi = globalThis.window.desktop;
    if (runtimeMode === 'desktop' && desktopApi) {
      void desktopApi.recording
        .pauseResume()
        .then((state) => {
          setIsRecording(state.isRecording);
          setIsRecordingPaused(state.isPaused);
          setElapsedSeconds(state.elapsedSeconds);
        })
        .catch(() => {
          setAskError('Desktop pause/resume command failed.');
        });
      return;
    }

    setIsRecordingPaused((current) => !current);
  };

  const pageMeta = PAGE_META[view];

  return (
    <div className='relative flex h-dvh flex-col overflow-hidden bg-background text-foreground'>
      <div className='pointer-events-none absolute -top-24 -left-24 size-80 rounded-full bg-[var(--copilot-glow-primary)] blur-3xl' />
      <div className='pointer-events-none absolute top-20 right-0 size-[26rem] rounded-full bg-[var(--copilot-glow-secondary)] blur-3xl' />
      <div className='pointer-events-none absolute bottom-0 left-1/3 size-[30rem] rounded-full bg-cyan-500/10 blur-3xl dark:bg-[#06B6D4]/12' />
      <div className='relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[1800px]'>
        <AppSidebar
          activeView={view}
          deviceCheckTab={deviceCheckTab}
          onNavigate={setView}
          onDeviceCheckTab={setDeviceCheckTab}
          onStartRecording={startRecording}
          selectedMeeting={selectedMeeting}
        />
        <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
          <header className='sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85'>
            <div className='flex items-center justify-between px-5 py-4'>
              <div>
                <h1 className='text-lg font-semibold text-foreground'>{pageMeta.title}</h1>
                <p className='text-xs text-muted-foreground'>{pageMeta.description}</p>
              </div>
              <div className='flex items-center gap-3'>
                <Badge variant='outline' className='border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:text-[#67e8f9]'>
                  <IconBolt className='mr-1 size-3.5' />
                  Live AI
                </Badge>
                <Badge variant='outline' className='border-border bg-muted/60 text-foreground/80'>
                  {runtimeMode === 'desktop' ? `Desktop${desktopPlatform ? ` · ${desktopPlatform}` : ''}` : 'Web Preview'}
                </Badge>
                <ThemeToggle />
                <UserProfile />
              </div>
            </div>
          </header>

          <main
            className={cn(
              'min-h-0 flex-1 p-4 md:p-6',
              view === 'detail'
                ? 'flex min-h-0 flex-col overflow-hidden overscroll-contain'
                : 'overflow-y-auto overscroll-contain'
            )}
          >
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
                isPaused={isRecordingPaused}
                transcript={liveTranscript}
                askInput={askInput}
                setAskInput={setAskInput}
                onAskAi={askAi}
                aiAnswers={aiAnswers}
                isAsking={isAsking}
                askError={askError}
                onPauseResume={pauseResumeRecording}
                onStop={stopRecording}
              />
            )}
            {view === 'detail' && (
              <MeetingDetailScreen
                meeting={selectedMeeting}
                aiAnswers={aiAnswers}
                setView={setView}
                detailAskInput={detailAskInput}
                setDetailAskInput={setDetailAskInput}
                onAskAi={askAi}
                isAsking={isAsking}
                askError={askError}
              />
            )}
            {view === 'calendar' && <CalendarScreen onStartRecording={startRecording} />}
            {view === 'device-check' && (
              <DeviceCheckScreen
                isDesktop={runtimeMode === 'desktop'}
                activeTab={deviceCheckTab}
                onTabChange={setDeviceCheckTab}
              />
            )}
            {view === 'settings' && <SettingsScreen isDesktop={runtimeMode === 'desktop'} />}
          </main>
        </div>
      </div>
      {runtimeMode !== 'desktop' && (
        <FloatingWidget
          isRecording={isRecording}
          elapsedSeconds={elapsedSeconds}
          onPauseResume={pauseResumeRecording}
          onStop={stopRecording}
          onAsk={() => {
            setView('live');
          }}
        />
      )}
    </div>
  );
}
