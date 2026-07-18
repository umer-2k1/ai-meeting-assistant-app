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
  IconFolders,
  IconInfoCircle,
  IconHeadphones,
  IconLayoutDashboard,
  IconLoader2,
  IconMicrophone,
  IconLogout,
  IconMusic,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { useIntegrationHealth } from './use-integration-health';
import IntegrationReconnectBanner from './integration-reconnect-banner';
import {
  completeMeetingApi,
  createLiveMeetingApi,
  uploadMeetingAudioApi,
  importAudioApi,
  searchMeetingsApi,
  streamMeetingAnswer,
  updateMeetingTitleApi,
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

/** Stable id so the "Processing…" toast can be updated/dismissed in place. */
const FINALIZE_TOAST_ID = 'meeting-finalizing';

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
            visibleRecent.map((meeting) => {
              const isActive = activeView === 'detail' && meeting.id === selectedMeeting?.id;
              return (
                <button
                  key={meeting.id}
                  type='button'
                  onClick={() => onOpenMeeting(meeting.id)}
                  title={meeting.title}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-all duration-200',
                    isActive
                      ? 'border-primary/40 bg-primary/10 font-medium text-foreground shadow-sm'
                      : 'border-transparent text-muted-foreground hover:border-primary/40 hover:bg-muted/60'
                  )}
                >
                  <span
                    aria-hidden='true'
                    className={cn(
                      'size-1.5 shrink-0 rounded-full transition-all duration-200',
                      isActive
                        ? 'bg-primary shadow-[0_0_0_3px_var(--copilot-accent-muted)]'
                        : 'bg-muted-foreground/30'
                    )}
                  />
                  <span className='min-w-0 truncate'>{meeting.title}</span>
                </button>
              );
            })
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
  live: { label: 'Live', className: 'bg-red-500 text-white border-transparent' },
  processing: { label: 'Processing', className: 'bg-amber-500/15 text-amber-600 border-amber-500/40' },
  scheduled: { label: 'Upcoming', className: 'bg-blue-500/10 text-blue-600 border-blue-500/40' },
  completed: { label: 'Completed', className: 'border-border text-muted-foreground' },
  failed: { label: 'Failed', className: 'bg-red-500/10 text-red-600 border-red-500/40' },
  archived: { label: 'Archived', className: 'border-border text-muted-foreground' }
};

/**
 * A meeting that just finished recording is still being finalized: the backend
 * moves it LIVE → PROCESSING → COMPLETED while it generates the transcript,
 * summary, action items, and stores the audio. Until it reaches a terminal
 * state its detail page has nothing to show, so the dashboard renders it as a
 * non-interactive "Processing…" card instead of a clickable (blank) meeting.
 */
function isMeetingProcessing(meeting: Meeting): boolean {
  return meeting.status === 'processing' || meeting.status === 'live';
}

/**
 * Dashboard card for a meeting that is still being processed. Mirrors the layout
 * of a normal meeting card (title, time, duration) but is not clickable and
 * shows a skeleton where the summary will land, so the user can see the
 * recording is being worked on rather than mistaking it for a live/broken one.
 */
function ProcessingMeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <Card className={cn(SURFACE, 'cursor-default')} aria-busy='true'>
      <CardHeader className='space-y-3'>
        <div className='flex items-center justify-between gap-3'>
          <CardTitle className='text-foreground'>{meeting.title || 'New recording'}</CardTitle>
          <Badge
            variant='outline'
            className='shrink-0 border-amber-500/40 bg-amber-500/15 text-amber-600'
          >
            <IconLoader2 className='mr-1 size-3 animate-spin' />
            Processing
          </Badge>
        </div>
        <div className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
          <span className='inline-flex items-center gap-1'>
            <IconClock className='size-3.5' />
            {meeting.startedAt}
          </span>
          {meeting.duration && meeting.duration !== '—' && <span>{meeting.duration}</span>}
        </div>
      </CardHeader>
      <CardContent className='space-y-3'>
        <p className='inline-flex items-center gap-2 text-sm text-muted-foreground'>
          <IconLoader2 className='size-4 animate-spin text-primary' />
          Processing recording… transcript, summary, and audio will appear here shortly.
        </p>
        <div className='space-y-2' aria-hidden='true'>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-4/5' />
          <Skeleton className='h-4 w-3/5' />
        </div>
      </CardContent>
    </Card>
  );
}

/** Extensions accepted by the audio importer — kept in sync with the file input's
 * `accept` and used for both the displayed hint and drag-drop validation. */
const IMPORT_AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm'] as const;
const IMPORT_AUDIO_ACCEPT = `audio/*,${IMPORT_AUDIO_EXTENSIONS.map((e) => `.${e}`).join(',')}`;

/** True when a File looks like an importable audio clip (by MIME or extension). */
function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return !!ext && (IMPORT_AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * "Import Audio" trigger that opens a drag & drop dialog instead of jumping
 * straight to the OS file picker. Files can be dropped onto the zone or chosen
 * via "Browse files". Styled from the shared copilot design tokens.
 */
function ImportAudioDialog({ onImportAudio }: { onImportAudio: (file: File) => void }) {
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!isAudioFile(file)) {
      toast.error('Unsupported file. Please choose an audio file.');
      return;
    }
    onImportAudio(file);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setIsDragging(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant='outline' className={COPILOT_BTN_OUTLINE}>
          <IconUpload className='mr-1.5 size-4' />
          Import Audio
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Import Audio</DialogTitle>
          <DialogDescription>
            Drop an audio file to transcribe and analyze it as a new meeting.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type='file'
          accept={IMPORT_AUDIO_ACCEPT}
          className='hidden'
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            accept(file);
          }}
        />

        <div
          role='button'
          tabIndex={0}
          aria-label='Drag and drop an audio file, or activate to browse'
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            accept(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/30 hover:border-primary/60 hover:bg-muted/50'
          )}
        >
          {/* Children ignore pointer events so dragging over them doesn't fire dragleave. */}
          <div className='pointer-events-none flex flex-col items-center gap-3'>
            <span
              className={cn(
                'flex size-12 items-center justify-center rounded-full transition-colors',
                isDragging ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              <IconMusic className='size-6' />
            </span>
            <div className='space-y-1'>
              <p className='text-base font-semibold text-foreground'>
                {isDragging ? 'Drop to import' : 'Drag & drop your audio file'}
              </p>
              <p className='text-xs text-muted-foreground'>
                {IMPORT_AUDIO_EXTENSIONS.map((e) => e.toUpperCase()).join(', ')}
              </p>
            </div>
          </div>

          <span className='pointer-events-none text-xs text-muted-foreground'>or</span>

          <Button
            type='button'
            className='pointer-events-none bg-primary text-white hover:bg-primary/90'
            tabIndex={-1}
          >
            Browse files
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
              <div className='text-2xl font-semibold text-foreground'>
                {isLoading ? <Skeleton className='h-8 w-16' /> : stat.value}
              </div>
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
        <ImportAudioDialog onImportAudio={onImportAudio} />
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
            // Still finalizing → show a non-clickable processing card instead of
            // a clickable card that would open an empty detail page.
            if (isMeetingProcessing(meeting)) {
              return <ProcessingMeetingCard key={meeting.id} meeting={meeting} />;
            }
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
                  'cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/60'
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
  title,
  onTitleChange,
  onTitleCommit,
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
  title: string;
  onTitleChange: (value: string) => void;
  onTitleCommit: () => void;
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
            value={title}
            onChange={(event) => onTitleChange(event.currentTarget.value)}
            onBlur={onTitleCommit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            placeholder='Meeting title'
            aria-label='Meeting title'
            className={COPILOT_INPUT}
          />
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='outline' className='border-border text-foreground' onClick={onPauseResume}>
              <IconPlayerPause className='mr-1.5 size-4' />
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant='destructive' onClick={() => onStop()}>
              <IconPlayerStop className='mr-1.5 size-4' />
              Stop
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase'>
            Live Transcript
          </p>
          <div aria-live='polite' className='max-h-[max(280px,50dvh)] space-y-3 overflow-y-auto pr-2'>
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
              <Button
                size='icon'
                type='submit'
                disabled={isAsking}
                aria-label='Ask AI'
                className='bg-primary text-primary-foreground'
              >
                <IconArrowUp className='size-4' />
              </Button>
            </div>
            <div className='flex flex-wrap gap-2'>
              {QUICK_ASK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type='button'
                  className='rounded-full border border-border bg-muted/70 px-3 py-1 text-xs text-foreground/80 hover:border-primary'
                  onClick={async () => {
                    await onAskAi(prompt);
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
            {isAsking && (
              <p className='inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400'>
                <span className='inline-block size-2 animate-pulse rounded-full bg-cyan-500' />
                AI is analyzing the meeting context...
              </p>
            )}
            {askError && (
              <p className='inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400'>
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
            <div className='max-h-[max(320px,60dvh)] space-y-3 overflow-y-auto overscroll-contain pr-1'>
              {aiAnswers.map((answer) => (
                <div key={answer.id} className='space-y-1.5'>
                  <div className='ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-sm text-primary-foreground'>
                    {answer.question}
                  </div>
                  <div className='w-fit max-w-[95%] rounded-2xl rounded-bl-sm border border-border/70 bg-muted/70 px-3 py-1.5 text-sm text-foreground/90'>
                    {answer.answer ||
                      (answer.error ? null : (
                        <span className='inline-flex items-center gap-1 text-muted-foreground'>
                          <span className='inline-block size-2 animate-pulse rounded-full bg-primary' />
                          Thinking…
                        </span>
                      ))}
                    {answer.error && (
                      <span className='mt-1 flex items-center gap-2 text-xs text-destructive'>
                        <IconInfoCircle className='size-3.5 shrink-0' />
                        Answer interrupted.
                        <button
                          type='button'
                          className='font-medium underline underline-offset-2 hover:text-destructive/80'
                          onClick={() => void onAskAi(answer.question)}
                          disabled={isAsking}
                        >
                          Retry
                        </button>
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
  meetingTitle,
  onPauseResume,
  onStop,
  onAsk
}: {
  isRecording: boolean;
  elapsedSeconds: number;
  meetingTitle: string;
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
    <div className={cn('fixed right-4 bottom-4 z-40 w-80 max-w-[calc(100vw-2rem)] p-3', SURFACE)}>
      <p className='mb-1 text-sm font-semibold text-foreground'>AI Meeting Copilot</p>
      <p className='text-sm text-foreground/85'>🔴 Recording {mm}:{ss}</p>
      <p className='mt-1 truncate text-xs text-muted-foreground'>{meetingTitle || 'Untitled meeting'}</p>
      <div className='mt-2 flex gap-2'>
        <Button size='sm' variant='outline' className='border-primary/50 text-primary' onClick={onAsk}>
          Ask AI
        </Button>
        <Button size='sm' variant='outline' className={COPILOT_BTN_OUTLINE} onClick={onPauseResume}>
          <IconPlayerPause className='mr-1.5 size-3.5' />
          Pause
        </Button>
        <Button size='sm' variant='destructive' onClick={() => onStop()}>
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
  // True from the moment a recording is stopped until its meeting finishes
  // processing (or fails). Drives the non-blocking "Processing…" indicator.
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('web');
  const [desktopPlatform, setDesktopPlatform] = useState<string | null>(null);
  const [deviceCheckTab, setDeviceCheckTab] = useState<DeviceCheckTab>('microphone');
  const [prepContext, setPrepContext] = useState<PreMeetingContext | null>(null);
  const [askInput, setAskInput] = useState('');
  const [liveTitle, setLiveTitle] = useState('');
  const [detailAskInput, setDetailAskInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [aiAnswers, setAiAnswers] = useState<AiAnswer[]>([]);
  // Re-checked periodically: a grant can die mid-session, and the only fix is
  // re-consent, so the prompt has to find the user wherever they are.
  const { revoked: revokedIntegrations } = useIntegrationHealth({ pollMs: 5 * 60 * 1000 });

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

  // True while any meeting in the list is still being finalized — drives the
  // dashboard's background polling so a just-stopped recording flips from
  // "Processing…" to a real, openable meeting on its own (no app reopen needed).
  const hasProcessingMeetings = useMemo(
    () => meetingList.some(isMeetingProcessing),
    [meetingList]
  );

  // Auto-refresh while a meeting is still processing so the AI summary, title,
  // tags, and audio appear on their own (and the title types out) — no manual
  // "Refresh to see results" or app reopen needed. We poll whenever the open
  // meeting OR any dashboard row is processing, so the list updates even when no
  // detail is open. Delay backs off 3s → 10s so a slow job doesn't hammer the
  // backend.
  useEffect(() => {
    const detailStatus = selectedMeetingDetail?.status;
    const detailPending = detailStatus === 'processing' || detailStatus === 'live';
    if (!detailPending && !hasProcessingMeetings) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let delay = 3000;
    const tick = () => {
      timer = globalThis.setTimeout(() => {
        void Promise.allSettled([refetchDetail(), refetchMeetings()]).then(() => {
          if (cancelled) return;
          delay = Math.min(delay * 1.5, 10_000);
          tick();
        });
      }, delay);
    };
    tick();
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [selectedMeetingDetail?.status, hasProcessingMeetings, refetchDetail, refetchMeetings]);

  // Clear the "Processing…" indicator once the finalized meeting reaches a
  // terminal state (or after a safety cap, so a stuck backend never pins the
  // toast open forever).
  useEffect(() => {
    if (!isFinalizing) return;
    const status = selectedMeetingDetail?.status;
    if (status === 'completed' || status === 'failed') {
      setIsFinalizing(false);
      if (status === 'completed') toast.success('Meeting processed', { id: FINALIZE_TOAST_ID });
      else toast.error('Processing failed — open the meeting to retry', { id: FINALIZE_TOAST_ID });
      return;
    }
    const safety = globalThis.setTimeout(() => {
      setIsFinalizing(false);
      toast.dismiss(FINALIZE_TOAST_ID);
    }, 120_000);
    return () => globalThis.clearTimeout(safety);
  }, [isFinalizing, selectedMeetingDetail?.status]);

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

  // Closing the tab/app must end the recording. `pagehide` fires on real
  // navigation-away/close (not on tab switches). We close the WebSocket so the
  // backend's WS-close finalizer runs; the server-side idle watchdog is the
  // backstop. A Bearer-authed `/complete` fetch can't reliably run during
  // unload, so we intentionally don't attempt one here.
  useEffect(() => {
    const handlePageHide = () => {
      if (isRecording) void stopLive();
    };
    globalThis.window.addEventListener('pagehide', handlePageHide);
    return () => globalThis.window.removeEventListener('pagehide', handlePageHide);
  }, [isRecording, stopLive]);

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
      // Never hijack keys while the user is typing in a field — otherwise the
      // Space shortcut below pauses the recording on every space you type into
      // the Ask box (and Cmd+N/K collide with text). Bail on inputs, textareas,
      // selects, and any contenteditable region.
      const target = event.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (isTyping) return;

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

  const selectedMeeting = useMemo(() => {
    // Prefer the full detail only when it matches the current selection.
    // Otherwise fall back to the list row so switching meetings updates the UI
    // instantly, rather than briefly showing the previously-open meeting's
    // detail while its replacement is still refetching (which read as "lag").
    if (selectedMeetingDetail && selectedMeetingDetail.id === selectedMeetingId) {
      return selectedMeetingDetail;
    }
    return meetingList.find((m) => m.id === selectedMeetingId) ?? null;
  }, [selectedMeetingDetail, meetingList, selectedMeetingId]);

  const filteredMeetings = searchText.trim() ? searchResults ?? [] : meetingList;

  // Opening a meeting that is still finalizing would show an empty detail page.
  // Guard every open path (dashboard cards, sidebar "Recent") so a processing
  // meeting stays put with a hint instead of a blank screen.
  const openMeeting = (meetingId: string) => {
    const target = meetingList.find((m) => m.id === meetingId);
    if (target && isMeetingProcessing(target)) {
      toast.info('This recording is still processing — it will open when ready.');
      return;
    }
    setSelectedMeetingId(meetingId);
    setView('detail');
  };

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
      // Keep whatever streamed before the drop and mark the answer as
      // interrupted — the panel shows a Retry affordance instead of silently
      // presenting a truncated answer as complete.
      setAskError('Ask AI is temporarily unavailable. Please retry.');
      setAiAnswers((current) =>
        current.map((a) => (a.id === answerId ? { ...a, error: true } : a))
      );
    } finally {
      setIsAsking(false);
    }
  };

  // Persist the live-session title when the user finishes editing it.
  const commitLiveTitle = () => {
    const meetingId = selectedMeetingId;
    const title = liveTitle.trim();
    if (!meetingId || !title) return;
    void updateMeetingTitleApi(meetingId, title)
      .then(() => {
        void refetchMeetings();
        void refetchDetail();
      })
      .catch(() => {
        toast.error('Could not save the meeting title.');
      });
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
        const defaultTitle = `Live session · ${new Date().toLocaleString()}`;
        const meeting = await createLiveMeetingApi(defaultTitle);
        liveMeetingId = meeting.id;
        setSelectedMeetingId(meeting.id);
        setLiveTitle(meeting.title || defaultTitle);
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

  // `nextView` is where to land after stopping. Defaults to the dashboard, where
  // the just-stopped meeting shows a non-clickable "Processing…" card until it
  // finishes finalizing (rather than dropping the user on an empty detail page).
  // Leaving the live view via the sidebar passes the clicked destination instead
  // so the user lands where they intended.
  const stopRecording = (nextView: View = 'dashboard') => {
    // Defensive: this is wired to button `onClick` in a couple of places, so a
    // stray event object (or any non-View) must never reach `setView` — doing so
    // used to blank the whole app (PAGE_META[view] undefined → render crash).
    const destination: View = typeof nextView === 'string' ? nextView : 'dashboard';
    const meetingId = selectedMeetingId;
    // `stopLive()` resolves after the recorder flushes its final chunk, so the
    // uploaded blob is guaranteed complete (no timing guess).
    const stopped = stopLive();

    const finalize = () => {
      setIsRecording(false);
      setIsRecordingPaused(false);
      if (meetingId) {
        // Give the user immediate, non-blocking feedback that the meeting is
        // being processed (summary/action items) — the detail screen also shows
        // an inline processing banner once its status refresh lands.
        setIsFinalizing(true);
        toast.loading('Processing your meeting…', { id: FINALIZE_TOAST_ID });
        void stopped.then(() => {
          const blob = takeRecording();
          if (blob && blob.size > 0) {
            const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
            console.info(`[audio] captured ${sizeMb} MB for meeting ${meetingId}; uploading…`);
            void uploadMeetingAudioApi(meetingId, blob)
              .then((result) => {
                if (result.stored) {
                  console.info(`[audio] stored for meeting ${meetingId}: ${result.audioUrl}`);
                } else {
                  // Request succeeded but nothing was persisted (e.g. Cloudinary
                  // not configured) — say so instead of silently showing no audio.
                  console.warn(`[audio] not stored for meeting ${meetingId} (audio storage not configured)`);
                  toast.info('Recording saved, but audio playback is not configured on the server.');
                }
                void refetchDetail();
              })
              .catch((err) => {
                // No longer swallowed: the upload genuinely failed. Log the
                // server detail and tell the user so missing audio isn't a mystery.
                console.error(`[audio] upload failed for meeting ${meetingId}:`, err);
                toast.error('Could not save the recording audio — see the console/terminal for details.');
              });
          } else {
            // The recorder produced nothing — points at mic/capture, not upload.
            console.warn(
              `[audio] no audio captured for meeting ${meetingId} (blob=${blob ? `${blob.size} bytes` : 'null'}); nothing to upload`
            );
            toast.error('No audio was captured for this recording.');
          }
        });
        // Trigger post-meeting processing (summary/action items) and refresh.
        void completeMeetingApi(meetingId)
          .then(() => {
            void refetchMeetings();
            void refetchDetail();
          })
          .catch(() => {
            // Processing failures surface on the detail screen via status.
          });
        setView(destination);
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

  // Navigating away from a live recording (e.g. clicking "Dashboard" in the
  // sidebar) ends the session — stop the recorder, finalize the meeting, and
  // land on the requested view. Without this the recording keeps running in the
  // background and the meeting is stranded at LIVE.
  const handleNavigate = (target: View) => {
    if (view === 'live' && isRecording && target !== 'live') {
      stopRecording(target);
      return;
    }
    setView(target);
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
      <div className='pointer-events-none absolute bottom-0 left-1/3 size-[30rem] rounded-full bg-cyan-500/10 blur-3xl dark:bg-cyan-500/15' />
      <div className='relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[1800px]'>
        <AppSidebar
          activeView={view}
          onNavigate={handleNavigate}
          onStartRecording={startRecording}
          recentMeetings={meetingList}
          selectedMeeting={selectedMeeting}
          isRecording={isRecording}
          onOpenMeeting={openMeeting}
        />
        <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
          <header className='sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85'>
            <div className='flex items-center justify-between px-5 py-4'>
              <div>
                <h1 className='text-lg font-semibold text-foreground'>{pageMeta.title}</h1>
                <p className='text-xs text-muted-foreground'>{pageMeta.description}</p>
              </div>
              <div className='flex items-center gap-3'>
                <Badge variant='outline' className='border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'>
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
            {/* Settings already shows per-integration reconnect state, and the
                live view stays clear while recording. */}
            {view !== 'settings' && view !== 'live' && (
              <IntegrationReconnectBanner
                revoked={revokedIntegrations}
                onManageIntegrations={() => setView('settings')}
              />
            )}
            {view === 'dashboard' && (
              <DashboardScreen
                filteredMeetings={filteredMeetings}
                allMeetings={meetingList}
                searchText={searchText}
                setSearchText={setSearchText}
                onOpenMeeting={openMeeting}
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
                title={liveTitle}
                onTitleChange={setLiveTitle}
                onTitleCommit={commitLiveTitle}
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
          meetingTitle={liveTitle || selectedMeeting?.title || ''}
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
