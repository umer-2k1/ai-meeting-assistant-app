import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

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
  IconLoader2,
  IconMicrophone,
  IconLogout,
  IconPlayerPause,
  IconPlayerStop,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconUpload,
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
import PreMeetingScreen, { type PreMeetingContext } from './pre-meeting-screen';
import DeviceCheckScreen, { type DeviceCheckTab } from './device-check-screen';
import MeetingDetailScreen from './meeting-detail/meeting-detail-screen';
import { useMeetingDetail, useMeetingList } from './use-meetings-data';
import { useLiveTranscription } from './use-live-transcription';
import {
  completeMeetingApi,
  createLiveMeetingApi,
  uploadMeetingAudioApi,
  importAudioApi,
  searchMeetingsApi,
  streamMeetingAnswer,
} from './meetings-api';
import { Skeleton } from '@/components/ui/skeleton';
import { BrandLogo } from '@/components/brand/brand-mark';
import { BrandLoader } from '@/components/brand/brand-loader';
import type { AiAnswer, Meeting, TranscriptLine } from './types';

type View = 'dashboard' | 'live' | 'detail' | 'calendar' | 'device-check' | 'settings' | 'prep';
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
  { id: 'device-check', label: 'Device Check', icon: IconHeadphones },
  { id: 'settings', label: 'Settings', icon: IconSettings }
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
  },
  prep: {
    title: 'Pre-Meeting Brief',
    description: 'Context, attendee intelligence, and talking points before you join.'
  }
};


function AppSidebar({
  activeView,
  onNavigate,
  onStartRecording,
  recentMeetings,
  selectedMeeting,
  isRecording,
  onOpenMeeting
}: {
  activeView: View;
  onNavigate: (view: View) => void;
  onStartRecording: () => void;
  recentMeetings: Meeting[];
  selectedMeeting: Meeting | null;
  isRecording: boolean;
  onOpenMeeting: (meetingId: string) => void;
}) {
  const { user, logout } = useAuth();
  const [showAllRecent, setShowAllRecent] = useState(false);
  const visibleRecent = showAllRecent ? recentMeetings : recentMeetings.slice(0, 5);
  return (
    <aside className='sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-border bg-sidebar p-4 text-sidebar-foreground lg:flex'>
      <div className='mb-3 inline-flex items-center rounded-xl border border-primary/30 bg-card px-3 py-2'>
        <BrandLogo size={32} animated={activeView === 'live'} />
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
                  ? 'bg-primary text-primary-foreground shadow-sm'
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
          Recent
        </p>
        <div
          className={cn(
            'space-y-1',
            showAllRecent && 'max-h-64 overflow-y-auto overscroll-contain pr-1'
          )}
        >
          {recentMeetings.length === 0 ? (
            <p className='px-2 py-1.5 text-xs text-muted-foreground'>No meetings yet</p>
          ) : (
            visibleRecent.map((meeting) => (
              <button
                key={meeting.id}
                type='button'
                onClick={() => onOpenMeeting(meeting.id)}
                title={meeting.title}
                className='block w-full truncate rounded-lg border border-transparent px-2 py-1.5 text-left text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/60'
              >
                {meeting.title}
              </button>
            ))
          )}
        </div>
        {recentMeetings.length > 5 && (
          <button
            type='button'
            onClick={() => setShowAllRecent((v) => !v)}
            className='mt-1 w-full rounded-lg px-2 py-1 text-left text-[11px] font-medium text-primary hover:underline'
          >
            {showAllRecent ? 'Show less' : `View more (${recentMeetings.length - 5})`}
          </button>
        )}
      </div>

      {isRecording && selectedMeeting && (
        <div className='mt-4 rounded-xl border border-primary/40 bg-primary/5 p-3'>
          <p className='inline-flex items-center gap-1.5 text-[11px] font-medium text-primary'>
            <IconCircleFilled className='size-2.5 animate-pulse' /> Recording now
          </p>
          <p className='mt-1 truncate text-sm font-medium text-foreground' title={selectedMeeting.title}>
            {selectedMeeting.title}
          </p>
          <p className='mt-1 text-xs text-muted-foreground'>{selectedMeeting.duration}</p>
        </div>
      )}

      <Button
        className='mt-auto bg-primary hover:bg-primary/90 text-white hover:opacity-95'
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

const STATUS_BADGE: Record<Meeting['status'], { label: string; className: string }> = {
  live: { label: 'Live', className: 'bg-[#EF4444] text-white border-transparent' },
  processing: { label: 'Processing', className: 'bg-amber-500/15 text-amber-600 border-amber-500/40' },
  scheduled: { label: 'Upcoming', className: 'bg-blue-500/10 text-blue-600 border-blue-500/40' },
  completed: { label: 'Completed', className: 'border-border text-muted-foreground' },
  failed: { label: 'Failed', className: 'bg-red-500/10 text-red-600 border-red-500/40' },
  archived: { label: 'Archived', className: 'border-border text-muted-foreground' }
};

function DashboardScreen({
  filteredMeetings,
  allMeetings,
  searchText,
  setSearchText,
  onOpenMeeting,
  onStartRecording,
  onImportAudio,
  isLoading,
  isSearching,
  error,
  onRetry
}: {
  filteredMeetings: Meeting[];
  allMeetings: Meeting[];
  searchText: string;
  setSearchText: (value: string) => void;
  onOpenMeeting: (meetingId: string) => void;
  onStartRecording: () => void;
  onImportAudio: (file: File) => void;
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const completedCount = allMeetings.filter((m) => m.status === 'completed').length;
  const actionItemTotal = allMeetings.reduce((sum, m) => sum + (m.actionItemCount ?? 0), 0);
  const liveOrProcessing = allMeetings.filter(
    (m) => m.status === 'live' || m.status === 'processing'
  ).length;
  const statCards = [
    { label: 'Total Meetings', value: String(allMeetings.length) },
    { label: 'Completed', value: String(completedCount) },
    { label: 'Action Items', value: String(actionItemTotal) },
    { label: 'Live / Processing', value: String(liveOrProcessing) }
  ];

  return (
    <section className='space-y-5'>
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
        {statCards.map((stat) => (
          <Card key={stat.label} className={SURFACE}>
            <CardContent className='space-y-1'>
              <p className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>{stat.label}</p>
              <p className='text-2xl font-semibold text-foreground'>
                {isLoading ? <Skeleton className='h-8 w-16' /> : stat.value}
              </p>
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
          className='bg-primary hover:bg-primary/90 text-white'
          onClick={() => {
            onStartRecording();
          }}
        >
          <IconMicrophone className='mr-1.5 size-4' />
          Start New Recording
        </Button>
        <input
          ref={importInputRef}
          type='file'
          accept='audio/*,.mp3,.wav,.m4a,.webm,.ogg'
          className='hidden'
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) onImportAudio(file);
          }}
        />
        <Button
          variant='outline'
          className={COPILOT_BTN_OUTLINE}
          onClick={() => importInputRef.current?.click()}
        >
          <IconUpload className='mr-1.5 size-4' />
          Import Audio
        </Button>
      </div>

      <div className='space-y-3'>
        <div className='flex items-center gap-2'>
          <IconFolders className='size-4 text-muted-foreground' />
          <h2 className='text-lg font-semibold text-foreground'>
            {searchText.trim() ? 'Search Results' : 'Recent Meetings'}
          </h2>
          {isSearching && <IconLoader2 className='size-4 animate-spin text-muted-foreground' />}
        </div>

        {error ? (
          <Card className={SURFACE}>
            <CardContent className='flex flex-col items-center gap-3 py-10 text-center'>
              <p className='text-sm text-muted-foreground'>{error}</p>
              <Button variant='outline' className={COPILOT_BTN_OUTLINE} onClick={onRetry}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className='space-y-3'>
            {[0, 1, 2].map((i) => (
              <Card key={i} className={SURFACE}>
                <CardHeader className='space-y-3'>
                  <Skeleton className='h-5 w-2/5' />
                  <Skeleton className='h-3 w-3/5' />
                </CardHeader>
                <CardContent className='space-y-3'>
                  <Skeleton className='h-4 w-full' />
                  <Skeleton className='h-4 w-4/5' />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredMeetings.length === 0 ? (
          <Card className={SURFACE}>
            <CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
              <IconFolders className='size-8 text-muted-foreground/60' />
              <div>
                <p className='text-sm font-medium text-foreground'>
                  {searchText.trim() ? 'No meetings match your search' : 'No meetings yet'}
                </p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  {searchText.trim()
                    ? 'Try a different search term.'
                    : 'Start a recording or connect your calendar to see meetings here.'}
                </p>
              </div>
              {!searchText.trim() && (
                <Button
                  className='bg-primary hover:bg-primary/90 text-white'
                  onClick={onStartRecording}
                >
                  <IconMicrophone className='mr-1.5 size-4' />
                  Start New Recording
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredMeetings.map((meeting) => {
            const badge = STATUS_BADGE[meeting.status];
            return (
              <Card
                key={meeting.id}
                role='button'
                tabIndex={0}
                onClick={() => onOpenMeeting(meeting.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenMeeting(meeting.id);
                  }
                }}
                className={cn(
                  SURFACE,
                  'cursor-pointer transition-all hover:-translate-y-0.5 hover:border-[#3B82F6]/60'
                )}
              >
                <CardHeader className='space-y-3'>
                  <div className='flex items-center justify-between gap-3'>
                    <CardTitle className='text-foreground'>{meeting.title}</CardTitle>
                    <Badge variant='outline' className={cn('shrink-0', badge.className)}>
                      {badge.label}
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
                    {meeting.platformUrl && (
                      <a
                        href={meeting.platformUrl}
                        target='_blank'
                        rel='noreferrer'
                        onClick={(e) => e.stopPropagation()}
                        className='inline-flex items-center gap-1 text-primary hover:underline'
                      >
                        <IconArrowUpRight className='size-3.5' />
                        {meeting.platform || 'Join'}
                      </a>
                    )}
                  </div>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <p className='text-sm text-foreground/80'>{meeting.summarySnippet}</p>
                  {meeting.tags.length > 0 && (
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
                  )}
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <p className='text-xs text-muted-foreground'>
                      {meeting.actionItemCount ?? meeting.actionItems.length} action items • {meeting.decisions.length} decisions
                    </p>
                    <Button
                      size='sm'
                      className='bg-primary text-primary-foreground hover:bg-primary/90'
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMeeting(meeting.id);
                      }}
                    >
                      Open Meeting
                      <IconArrowUpRight className='ml-1 size-3.5' />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}

function LiveScreen({
  elapsedSeconds,
  isRecording,
  isPaused,
  transcript,
  interimLine,
  askInput,
  setAskInput,
  onAskAi,
  aiAnswers,
  isAsking,
  askError,
  onPauseResume,
  onStop,
  onStart
}: {
  elapsedSeconds: number;
  isRecording: boolean;
  isPaused: boolean;
  transcript: TranscriptLine[];
  interimLine: TranscriptLine | null;
  askInput: string;
  setAskInput: (value: string) => void;
  onAskAi: (question?: string) => Promise<void>;
  aiAnswers: AiAnswer[];
  isAsking: boolean;
  askError: string | null;
  onPauseResume: () => void;
  onStop: () => void;
  onStart: () => void;
}) {
  const mm = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (elapsedSeconds % 60).toString().padStart(2, '0');

  // Idle state: nothing is recording. Show a clear CTA instead of a stale
  // recording card / last session's transcript.
  if (!isRecording && !isPaused) {
    return (
      <Card className={cn(SURFACE, 'mx-auto max-w-xl')}>
        <CardContent className='flex flex-col items-center gap-4 py-14 text-center'>
          <div className='inline-flex size-14 items-center justify-center rounded-full bg-primary/10'>
            <IconMicrophone className='size-7 text-primary' />
          </div>
          <div className='space-y-1'>
            <p className='text-base font-semibold text-foreground'>No active recording</p>
            <p className='text-sm text-muted-foreground'>
              Start a new recording to capture live transcript, or open a past meeting
              from the dashboard.
            </p>
          </div>
          <Button className='bg-primary text-white hover:bg-primary/90' onClick={onStart}>
            <IconMicrophone className='mr-1.5 size-4' />
            Start New Recording
          </Button>
        </CardContent>
      </Card>
    );
  }

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
            <Button variant='secondary' className='bg-primary/10 text-primary hover:bg-primary/15'>
              <IconSparkles className='mr-1.5 size-4' />
              Highlight
            </Button>
            <Button variant='secondary' className='bg-primary/10 text-primary hover:bg-primary/15'>
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
            {transcript.length === 0 && !interimLine && (
              <p className='text-sm text-muted-foreground'>
                {isRecording ? 'Listening…' : 'Transcript will appear here once recording starts.'}
              </p>
            )}
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
            {/* Volatile tail: the line Deepgram is still revising. Greyed and
                append-only in feel, it firms up into a committed card on final —
                the Otter-style stable/volatile split, so text never flickers. */}
            {interimLine && (
              <div className={cn('rounded-lg border border-dashed p-3', COPILOT_INNER_PANEL)}>
                <p className='mb-1 text-xs font-medium text-muted-foreground'>
                  [{interimLine.timestamp}] {interimLine.speaker}
                </p>
                <p className='text-sm text-foreground/50'>
                  {interimLine.text}
                  <span className='ml-1 inline-block animate-pulse text-primary'>▍</span>
                </p>
              </div>
            )}
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

      {/* Ask-AI conversation lives in its own panel — separate from the live
          transcript scroll so asking never disturbs (or gets buried under) the
          transcript. Each turn shows your question + the streaming answer. */}
      <Card className={SURFACE}>
        <CardHeader>
          <CardTitle className='inline-flex items-center gap-2 text-foreground'>
            <IconSparkles className='size-4 text-primary' />
            Ask AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aiAnswers.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              Ask a question about the meeting so far — your questions and answers appear
              here, kept separate from the live transcript.
            </p>
          ) : (
            <div className='max-h-[460px] space-y-3 overflow-y-auto overscroll-contain pr-1'>
              {aiAnswers.map((answer) => (
                <div key={answer.id} className='space-y-1.5'>
                  <div className='ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-sm text-primary-foreground'>
                    {answer.question}
                  </div>
                  <div className='w-fit max-w-[95%] rounded-2xl rounded-bl-sm border border-border/70 bg-muted/70 px-3 py-1.5 text-sm text-foreground/90'>
                    {answer.answer || (
                      <span className='inline-flex items-center gap-1 text-muted-foreground'>
                        <span className='inline-block size-2 animate-pulse rounded-full bg-[#06B6D4]' />
                        Thinking…
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
  const routeParams = useParams();
  const [view, setView] = useState<View>(routeParams['meetingId'] ? 'detail' : 'dashboard');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    routeParams['meetingId'] ?? null
  );
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Meeting[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('web');
  const [desktopPlatform, setDesktopPlatform] = useState<string | null>(null);
  const [deviceCheckTab, setDeviceCheckTab] = useState<DeviceCheckTab>('microphone');
  const [prepContext, setPrepContext] = useState<PreMeetingContext | null>(null);
  const [askInput, setAskInput] = useState('');
  const [detailAskInput, setDetailAskInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [aiAnswers, setAiAnswers] = useState<AiAnswer[]>([]);

  const {
    meetings: meetingList,
    isLoading: meetingsLoading,
    error: meetingsError,
    refetch: refetchMeetings
  } = useMeetingList();
  const {
    meeting: selectedMeetingDetail,
    isLoading: detailLoading,
    error: detailError,
    refetch: refetchDetail
  } = useMeetingDetail(selectedMeetingId);
  const {
    transcript: liveTranscript,
    interimLine,
    start: startLive,
    stop: stopLive,
    takeRecording,
    error: liveError
  } = useLiveTranscription();

  // Auto-refresh while the open meeting is still processing so the AI summary,
  // title, and tags appear on their own (and the title types out) — no manual
  // "Refresh to see results" needed.
  useEffect(() => {
    const status = selectedMeetingDetail?.status;
    if (status !== 'processing' && status !== 'live') return;
    const id = globalThis.setInterval(() => {
      void refetchDetail();
      void refetchMeetings();
    }, 3000);
    return () => globalThis.clearInterval(id);
  }, [selectedMeetingDetail?.status, refetchDetail, refetchMeetings]);

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

    return () => {
      unsubscribeState();
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

  // Debounced backend search: empty query shows the full list.
  useEffect(() => {
    const query = searchText.trim();
    if (!query) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const handle = globalThis.setTimeout(() => {
      void searchMeetingsApi(query)
        .then((results) => setSearchResults(results))
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false));
    }, 300);
    return () => globalThis.clearTimeout(handle);
  }, [searchText]);

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
    () => selectedMeetingDetail ?? meetingList.find((m) => m.id === selectedMeetingId) ?? null,
    [selectedMeetingDetail, meetingList, selectedMeetingId]
  );

  const filteredMeetings = searchText.trim() ? searchResults ?? [] : meetingList;

  const askAi = async (questionOverride?: string) => {
    const question = (questionOverride ?? askInput).trim();
    if (!question || isAsking) return;

    const meetingId = selectedMeeting?.id;
    if (!meetingId) {
      setAskError('Open or start a meeting before asking the AI.');
      return;
    }

    setIsAsking(true);
    setAskError(null);

    // Insert a placeholder answer and stream tokens into it (RAG-grounded SSE).
    const answerId = crypto.randomUUID();
    setAiAnswers((current) => [
      { id: answerId, question, answer: '', timestamp: '' },
      ...current
    ]);
    if (!questionOverride) setAskInput('');

    try {
      const { timestamp } = await streamMeetingAnswer(meetingId, question, {
        onToken: (tokenText) => {
          setAiAnswers((current) =>
            current.map((a) =>
              a.id === answerId ? { ...a, answer: a.answer + tokenText } : a
            )
          );
        }
      });
      if (timestamp) {
        setAiAnswers((current) =>
          current.map((a) => (a.id === answerId ? { ...a, timestamp } : a))
        );
      }
    } catch {
      setAskError('Ask AI is temporarily unavailable. Please retry.');
      setAiAnswers((current) => current.filter((a) => a.id !== answerId));
    } finally {
      setIsAsking(false);
    }
  };

  const startRecording = () => {
    setView('live');
    setAskError(null);
    setIsRecordingPaused(false);
    setElapsedSeconds(0);
    setAiAnswers([]);

    const beginSession = (liveMeetingId: string) => {
      // Start the real renderer-side capture → WS → Deepgram pipeline.
      void startLive(liveMeetingId, { captureSystemAudio: runtimeMode === 'desktop' });

      const desktopApi = globalThis.window.desktop;
      if (runtimeMode === 'desktop' && desktopApi) {
        void desktopApi.recording
          .start()
          .then((state) => {
            if (state.blockedReason === 'microphone') {
              setAskError(
                'Microphone access is required. Run the Microphone Test under Device Check to enable it.'
              );
              setDeviceCheckTab('microphone');
              setView('device-check');
              return;
            }

            if (state.blockedReason === 'systemAudio') {
              setAskError(
                'System audio recording is required. Run the System Audio Test under Device Check to enable it.'
              );
              setDeviceCheckTab('system-audio');
              setView('device-check');
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
      // Create a real backend meeting for this session so transcript + summary
      // have a durable home. Audio streams into it; on stop it is processed.
      let liveMeetingId = '';
      try {
        const meeting = await createLiveMeetingApi(
          `Live session · ${new Date().toLocaleString()}`
        );
        liveMeetingId = meeting.id;
        setSelectedMeetingId(meeting.id);
      } catch {
        setAskError('Could not start a meeting on the server. Check your connection and retry.');
        setView('dashboard');
        return;
      }

      if (runtimeMode === 'desktop' && globalThis.window.desktop?.permissions) {
        const mic = await requestDesktopMicrophone();
        if (!mic?.granted) {
          setAskError(
            'Microphone access is required to record. Run the Microphone Test under Device Check.'
          );
          setDeviceCheckTab('microphone');
          setView('device-check');
          return;
        }
        beginSession(liveMeetingId);
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

      beginSession(liveMeetingId);
    })();
  };

  const stopRecording = () => {
    const meetingId = selectedMeetingId;
    stopLive();

    const finalize = () => {
      setIsRecording(false);
      setIsRecordingPaused(false);
      if (meetingId) {
        // Upload the recorded audio (best-effort) shortly after stop so the
        // final chunk lands; playback stays on the demo player if it fails.
        globalThis.setTimeout(() => {
          const blob = takeRecording();
          if (blob && blob.size > 0) {
            void uploadMeetingAudioApi(meetingId, blob)
              .then(() => void refetchDetail())
              .catch(() => {
                /* audio storage unavailable — playback stays demo */
              });
          }
        }, 600);
        // Trigger post-meeting processing (summary/action items) and refresh.
        void completeMeetingApi(meetingId)
          .then(() => {
            void refetchMeetings();
            void refetchDetail();
          })
          .catch(() => {
            // Processing failures surface on the detail screen via status.
          });
        setView('detail');
      } else {
        setView('dashboard');
      }
    };

    const desktopApi = globalThis.window.desktop;
    if (runtimeMode === 'desktop' && desktopApi) {
      void desktopApi.recording
        .stop()
        .then((state) => {
          setElapsedSeconds(state.elapsedSeconds);
          finalize();
        })
        .catch(() => {
          setAskError('Desktop stop command failed.');
          finalize();
        });
      return;
    }

    finalize();
  };

  const handleImportAudio = (file: File) => {
    toast.info(`Importing "${file.name}"…`);
    void importAudioApi(file)
      .then((meetingId) => {
        setSelectedMeetingId(meetingId);
        setView('detail');
        void refetchMeetings();
        void refetchDetail();
        toast.success('Audio imported — transcribing…');
      })
      .catch(() => {
        toast.error('Could not import audio. Check the file and try again.');
      });
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
          onNavigate={setView}
          onStartRecording={startRecording}
          recentMeetings={meetingList}
          selectedMeeting={selectedMeeting}
          isRecording={isRecording}
          onOpenMeeting={(meetingId) => {
            setSelectedMeetingId(meetingId);
            setView('detail');
          }}
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
                allMeetings={meetingList}
                searchText={searchText}
                setSearchText={setSearchText}
                onOpenMeeting={(meetingId) => {
                  setSelectedMeetingId(meetingId);
                  setView('detail');
                }}
                onStartRecording={startRecording}
                onImportAudio={handleImportAudio}
                isLoading={meetingsLoading}
                isSearching={isSearching}
                error={meetingsError}
                onRetry={() => void refetchMeetings()}
              />
            )}
            {view === 'live' && (
              <LiveScreen
                elapsedSeconds={elapsedSeconds}
                isRecording={isRecording}
                isPaused={isRecordingPaused}
                transcript={liveTranscript}
                interimLine={interimLine}
                askInput={askInput}
                setAskInput={setAskInput}
                onAskAi={askAi}
                aiAnswers={aiAnswers}
                isAsking={isAsking}
                askError={askError ?? liveError}
                onPauseResume={pauseResumeRecording}
                onStop={stopRecording}
                onStart={startRecording}
              />
            )}
            {view === 'detail' &&
              (selectedMeeting ? (
                <MeetingDetailScreen
                  meeting={selectedMeeting}
                  aiAnswers={aiAnswers}
                  setView={setView}
                  detailAskInput={detailAskInput}
                  setDetailAskInput={setDetailAskInput}
                  onAskAi={askAi}
                  isAsking={isAsking}
                  askError={askError}
                  onDeleted={() => {
                    setSelectedMeetingId(null);
                    void refetchMeetings();
                    setView('dashboard');
                  }}
                  onReprocess={() => void refetchDetail()}
                />
              ) : detailLoading ? (
                <div className='flex flex-1 items-center justify-center'>
                  <BrandLoader label='Loading meeting…' />
                </div>
              ) : (
                <div className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
                  <p className='text-sm text-muted-foreground'>
                    {detailError ?? 'Meeting not found.'}
                  </p>
                  <Button variant='outline' className={COPILOT_BTN_OUTLINE} onClick={() => setView('dashboard')}>
                    Back to dashboard
                  </Button>
                </div>
              ))}
            {view === 'calendar' && (
              <CalendarScreen
                onStartRecording={startRecording}
                onManageIntegrations={() => setView('settings')}
                onPrepare={(ctx) => {
                  setPrepContext(ctx);
                  setView('prep');
                }}
              />
            )}
            {view === 'prep' && prepContext && (
              <PreMeetingScreen context={prepContext} onBack={() => setView('calendar')} />
            )}
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
