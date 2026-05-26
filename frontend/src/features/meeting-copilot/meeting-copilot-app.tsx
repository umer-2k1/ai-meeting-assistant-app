import { useEffect, useMemo, useState } from 'react';

import {
  IconArrowUp,
  IconArrowUpRight,
  IconBolt,
  IconBrandSlack,
  IconCalendarEvent,
  IconCircleFilled,
  IconClock,
  IconCircleCheckFilled,
  IconFileText,
  IconFolders,
  IconInfoCircle,
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

import { askMeetingQuestion } from './api';
import { calendarEvents, meetings, quickAiAnswers, starterTranscript } from './mock-data';
import type { AiAnswer, Meeting, TranscriptLine } from './types';

type View = 'dashboard' | 'live' | 'detail' | 'calendar' | 'settings';
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

function priorityVariant(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') return 'destructive';
  if (priority === 'medium') return 'default';
  return 'outline';
}

const QUICK_ASK_PROMPTS = [
  'Who mentioned pricing discussion?',
  'What are my action items?',
  'Did anyone disagree with the timeline?'
] as const;

const SURFACE =
  'rounded-2xl border border-[#334155]/70 bg-[linear-gradient(140deg,rgba(30,41,59,0.92),rgba(15,23,42,0.9))] shadow-[0_14px_40px_rgba(2,6,23,0.45)] backdrop-blur-xl';

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
  onNavigate,
  onStartRecording,
  selectedMeeting
}: {
  activeView: View;
  onNavigate: (view: View) => void;
  onStartRecording: () => void;
  selectedMeeting: Meeting;
}) {
  return (
    <aside className='hidden w-64 shrink-0 border-r border-[#334155]/60 bg-[#060b1d]/95 p-4 lg:flex lg:flex-col'>
      <div className='mb-3 inline-flex items-center gap-3 rounded-xl border border-[#1E3A8A]/50 bg-[#0B1227]/90 px-3 py-2'>
        <div className='inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1E3A8A] via-[#3B82F6] to-[#06B6D4] text-white'>
          <IconBolt className='size-4' />
        </div>
        <div>
          <p className='text-sm font-semibold text-[#F1F5F9]'>Speller.ai</p>
          <p className='text-[11px] text-[#94A3B8]'>AI Meeting Copilot</p>
        </div>
      </div>

      <div className='rounded-xl border border-[#334155]/80 bg-[#0c142d]/80 p-3'>
        <p className='text-sm font-semibold text-[#F1F5F9]'>John Doe</p>
        <p className='text-xs text-[#94A3B8]'>john@company.com</p>
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
                  ? 'bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-[#F1F5F9] shadow-[0_8px_24px_rgba(59,130,246,0.35)]'
                  : 'text-[#c5d4ee] hover:bg-[#16244a] hover:text-[#F1F5F9]'
              )}
            >
              <Icon className='size-4' />
              {entry.label}
            </button>
          );
        })}
      </nav>

      <div className='mt-5'>
        <p className='mb-2 px-2 text-[11px] font-semibold tracking-[0.15em] text-[#64748B] uppercase'>
          Recent
        </p>
        <div className='space-y-1'>
          {meetings.slice(0, 3).map((meeting) => (
            <div
              key={meeting.id}
              className='rounded-lg border border-transparent px-2 py-1.5 text-xs text-[#9db4db] hover:border-[#1E3A8A]/50 hover:bg-[#0f1d3f]/70'
            >
              {meeting.title}
            </div>
          ))}
        </div>
      </div>

      <div className='mt-4 rounded-xl border border-[#334155]/80 bg-[#0c142d]/80 p-3'>
        <p className='text-[11px] text-[#94A3B8]'>Active meeting</p>
        <p className='text-sm font-medium text-[#F1F5F9]'>{selectedMeeting.title}</p>
        <p className='mt-1 text-xs text-[#94A3B8]'>{selectedMeeting.duration}</p>
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
              <p className='text-xs uppercase tracking-[0.12em] text-[#94A3B8]'>{stat.label}</p>
              <p className='text-2xl font-semibold text-[#F1F5F9]'>{stat.value}</p>
              <p className='text-xs text-[#06B6D4]'>{stat.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='flex flex-wrap items-center gap-3'>
        <div className='relative min-w-64 flex-1'>
          <IconSearch className='absolute top-2 left-2.5 size-4 text-[#94A3B8]' />
          <Input
            aria-label='Search all meetings'
            value={searchText}
            onChange={(event) => {
              setSearchText(event.currentTarget.value);
            }}
            className='border-[#334155] bg-[#0F172A]/70 pl-8 text-[#F1F5F9] placeholder:text-[#94A3B8] focus-visible:border-[#3B82F6]'
            placeholder='Search all meetings...'
          />
        </div>
        <Button variant='outline' className='border-[#334155] bg-[#0F172A]/70 text-[#F1F5F9]'>
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
        <Button variant='outline' className='border-[#334155] bg-[#0F172A]/70 text-[#F1F5F9]'>
          Import Audio
        </Button>
      </div>

      <div className='space-y-3'>
        <div className='flex items-center gap-2'>
          <IconFolders className='size-4 text-[#94A3B8]' />
          <h2 className='text-lg font-semibold text-[#F1F5F9]'>Recent Meetings</h2>
        </div>
        {filteredMeetings.map((meeting) => (
          <Card key={meeting.id} className={cn(SURFACE, 'transition-all hover:-translate-y-0.5 hover:border-[#3B82F6]/60')}>
            <CardHeader className='space-y-3'>
              <div className='flex items-center justify-between gap-3'>
                <CardTitle className='text-[#F1F5F9]'>{meeting.title}</CardTitle>
                <Badge
                  variant={meeting.status === 'live' ? 'default' : 'outline'}
                  className={cn(
                    meeting.status === 'live' && 'bg-[#EF4444] text-white',
                    meeting.status !== 'live' && 'border-[#334155] text-[#9db4db]'
                  )}
                >
                  {meeting.status === 'live' ? 'Live' : 'Completed'}
                </Badge>
              </div>
              <div className='flex flex-wrap items-center gap-3 text-xs text-[#94A3B8]'>
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
              <p className='text-sm text-[#c5d4ee]'>{meeting.summarySnippet}</p>
              <div className='flex flex-wrap gap-1'>
                {meeting.tags.map((tag) => (
                  <Badge
                    key={`${meeting.id}-${tag}`}
                    variant='outline'
                    className='border-[#334155] bg-[#0f1d3f]/70 text-[#9db4db]'
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-xs text-[#94A3B8]'>
                  {meeting.actionItems.length} action items • {meeting.decisions.length} decisions
                </p>
                <Button
                  size='sm'
                  className='bg-[#3B82F6] text-white hover:bg-[#2563eb]'
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
              <p className='text-sm font-semibold text-[#F1F5F9]'>Recording</p>
            </div>
            <p className='text-sm text-[#c5d4ee]'>Timer: {mm}:{ss}</p>
          </div>
          <Input
            defaultValue='Product Sync Meeting'
            aria-label='Meeting title'
            className='border-[#334155] bg-[#0F172A]/60 text-[#F1F5F9]'
          />
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='outline' className='border-[#334155] text-[#F1F5F9]' onClick={onPauseResume}>
              <IconPlayerPause className='mr-1.5 size-4' />
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant='destructive' onClick={onStop}>
              <IconPlayerStop className='mr-1.5 size-4' />
              Stop
            </Button>
            <Button variant='secondary' className='bg-[#1E3A8A]/30 text-[#dbe8ff] hover:bg-[#1E3A8A]/50'>
              <IconSparkles className='mr-1.5 size-4' />
              Highlight
            </Button>
            <Button variant='secondary' className='bg-[#1E3A8A]/30 text-[#dbe8ff] hover:bg-[#1E3A8A]/50'>
              <IconFileText className='mr-1.5 size-4' />
              Note
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-xs font-semibold tracking-[0.15em] text-[#94A3B8] uppercase'>
            Live Transcript
          </p>
          <div aria-live='polite' className='max-h-[420px] space-y-3 overflow-y-auto pr-2'>
            {transcript.map((line) => (
              <div
                key={line.id}
                className={cn(
                  'rounded-lg border p-3',
                  line.highlighted
                    ? 'border-[#06B6D4]/60 bg-[#0b2740]/70'
                    : 'border-[#334155]/70 bg-[#0F172A]/70'
                )}
              >
                <p className='mb-1 text-xs font-medium text-[#94A3B8]'>
                  [{line.timestamp}] {line.speaker}
                  {line.highlighted ? '  ⭐' : ''}
                </p>
                <p className='text-sm text-[#dbe8ff]'>{line.text}</p>
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
                className='border-[#334155] bg-[#0F172A]/60 text-[#F1F5F9]'
              />
              <Button size='icon' type='submit' disabled={isAsking} className='bg-[#3B82F6] text-white'>
                <IconArrowUp className='size-4' />
              </Button>
            </div>
            <div className='flex flex-wrap gap-2'>
              {QUICK_ASK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type='button'
                  className='rounded-full border border-[#334155] bg-[#0f1d3f]/70 px-3 py-1 text-xs text-[#c5d4ee] hover:border-[#3B82F6]'
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
          <CardTitle className='text-[#F1F5F9]'>Live Intelligence</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-[#94A3B8] uppercase'>Summary</p>
            <p className='mt-1 text-sm text-[#c5d4ee]'>
              Team is discussing Q3 priorities with focus on Dark Mode, API latency, and mobile
              performance.
            </p>
          </div>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-[#94A3B8] uppercase'>Key Decisions</p>
            <p className='mt-1 text-sm text-[#c5d4ee]'>
              API latency is now P0 priority for the sprint.
            </p>
          </div>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-[#94A3B8] uppercase'>Action Items</p>
            <p className='mt-1 text-sm text-[#c5d4ee]'>None detected yet during this live segment.</p>
          </div>
          <div className='space-y-2 border-t border-[#334155]/70 pt-3'>
            <p className='text-xs font-semibold tracking-[0.15em] text-[#94A3B8] uppercase'>Ask Responses</p>
            {aiAnswers.slice(0, 2).map((answer) => (
              <div key={answer.id} className='rounded-md border border-[#334155]/70 bg-[#0F172A]/70 p-2'>
                <p className='text-xs text-[#94A3B8]'>{answer.question}</p>
                <p className='text-sm text-[#dbe8ff]'>{answer.answer}</p>
                <p className='text-xs text-[#06B6D4]'>Timestamp: {answer.timestamp}</p>
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
  setView,
  detailAskInput,
  setDetailAskInput,
  onAskAi,
  isAsking,
  askError
}: {
  meeting: Meeting;
  aiAnswers: AiAnswer[];
  setView: (view: View) => void;
  detailAskInput: string;
  setDetailAskInput: (value: string) => void;
  onAskAi: (question?: string) => Promise<void>;
  isAsking: boolean;
  askError: string | null;
}) {
  return (
    <section className='grid gap-4 xl:grid-cols-[1fr_320px]'>
      <Card className={cn(SURFACE, 'xl:col-span-2')}>
        <CardHeader className='space-y-3'>
          <button
            type='button'
            onClick={() => {
              setView('dashboard');
            }}
            className='text-left text-xs text-[#94A3B8] hover:text-[#F1F5F9]'
          >
            ← Back to Dashboard
          </button>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <CardTitle className='text-xl text-[#F1F5F9]'>{meeting.title}</CardTitle>
            <div className='flex flex-wrap gap-2'>
              <Button size='sm' variant='outline' className='border-[#334155] text-[#F1F5F9]'>
                Share
              </Button>
              <Button size='sm' variant='outline' className='border-[#334155] text-[#F1F5F9]'>
                Export
              </Button>
              <Button size='sm' variant='outline' className='border-[#334155] text-[#F1F5F9]'>
                Email
              </Button>
              <Button size='sm' variant='outline' className='border-[#334155] text-[#F1F5F9]'>
                Slack
              </Button>
            </div>
          </div>
          <p className='text-sm text-[#94A3B8]'>
            {meeting.startedAt} • {meeting.duration} • {meeting.participantCount} participants
          </p>
          <div className='flex flex-wrap gap-1'>
            {meeting.tags.map((tag) => (
              <Badge
                key={`detail-${tag}`}
                variant='outline'
                className='border-[#334155] bg-[#0f1d3f]/70 text-[#9db4db]'
              >
                #{tag}
              </Badge>
            ))}
            <Button size='sm' variant='ghost' className='text-[#c5d4ee]'>
              <IconTag className='mr-1 size-4' />
              Add tag
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card className={SURFACE}>
        <CardContent>
          <Tabs defaultValue='summary' className='w-full'>
            <TabsList variant='line' className='mb-4 w-full justify-start rounded-xl bg-[#0f1d3f]/60 p-1'>
              <TabsTrigger value='summary'>Summary</TabsTrigger>
              <TabsTrigger value='transcript'>Transcript</TabsTrigger>
              <TabsTrigger value='actions'>Action Items</TabsTrigger>
              <TabsTrigger value='notes'>Notes</TabsTrigger>
              <TabsTrigger value='chat'>AI Chat</TabsTrigger>
            </TabsList>
            <TabsContent value='summary' className='space-y-3'>
              <div>
                <h3 className='text-sm font-semibold text-[#F1F5F9]'>Executive Summary</h3>
                <p className='text-sm text-[#c5d4ee]'>{meeting.aiSummary}</p>
              </div>
              <div>
                <h3 className='text-sm font-semibold text-[#F1F5F9]'>Key Decisions</h3>
                <ul className='list-inside list-disc space-y-1 text-sm text-[#c5d4ee]'>
                  {meeting.decisions.map((decision) => (
                    <li key={decision}>{decision}</li>
                  ))}
                </ul>
              </div>
            </TabsContent>
            <TabsContent value='transcript' className='space-y-2'>
              {meeting.transcript.map((line) => (
                <div key={line.id} className='rounded-md border border-[#334155]/70 bg-[#0F172A]/70 p-2'>
                  <p className='text-xs text-[#94A3B8]'>
                    [{line.timestamp}] {line.speaker}
                  </p>
                  <p className='text-sm text-[#dbe8ff]'>{line.text}</p>
                </div>
              ))}
            </TabsContent>
            <TabsContent value='actions' className='space-y-2'>
              {meeting.actionItems.map((item) => (
                <div key={item.id} className='rounded-md border border-[#334155]/70 bg-[#0F172A]/70 p-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                    <p className='text-xs text-[#94A3B8]'>{item.timestamp}</p>
                  </div>
                  <p className='mt-1 text-sm text-[#dbe8ff]'>
                    @{item.assignee} - {item.task}
                  </p>
                </div>
              ))}
            </TabsContent>
            <TabsContent value='notes'>
              <Textarea
                defaultValue={meeting.notes}
                rows={7}
                className='border-[#334155] bg-[#0F172A]/60 text-[#F1F5F9]'
              />
            </TabsContent>
            <TabsContent value='chat' className='space-y-2'>
              <form
                className='mb-2 flex gap-2'
                onSubmit={async (event) => {
                  event.preventDefault();
                  await onAskAi(detailAskInput);
                  setDetailAskInput('');
                }}
              >
                <Input
                  value={detailAskInput}
                  onChange={(event) => {
                    setDetailAskInput(event.currentTarget.value);
                  }}
                  placeholder='Ask this meeting anything...'
                  className='border-[#334155] bg-[#0F172A]/60 text-[#F1F5F9]'
                />
                <Button type='submit' disabled={isAsking} className='bg-[#3B82F6] text-white'>
                  Ask
                </Button>
              </form>
              {askError && (
                <p className='inline-flex items-center gap-1 text-xs text-[#F59E0B]'>
                  <IconInfoCircle className='size-3.5' />
                  {askError}
                </p>
              )}
              {aiAnswers.map((answer) => (
                <div key={answer.id} className='rounded-md border border-[#334155]/70 bg-[#0F172A]/70 p-2'>
                  <p className='text-xs text-[#94A3B8]'>{answer.question}</p>
                  <p className='text-sm text-[#dbe8ff]'>{answer.answer}</p>
                  <p className='text-xs text-[#06B6D4]'>Timestamp: {answer.timestamp}</p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className={SURFACE}>
        <CardHeader>
          <CardTitle className='text-[#F1F5F9]'>AI Insights</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-[#94A3B8] uppercase'>Action Items</p>
            {meeting.actionItems.map((item) => (
              <p key={`insight-${item.id}`} className='mt-1 text-sm text-[#c5d4ee]'>
                @{item.assignee} - {item.task} ({item.timestamp})
              </p>
            ))}
          </div>
          <div>
            <p className='text-xs font-semibold tracking-[0.15em] text-[#94A3B8] uppercase'>Quick Stats</p>
            <p className='mt-1 text-sm text-[#c5d4ee]'>Speaking time: John 45%, Sarah 30%, Marcus 25%</p>
            <p className='text-sm text-[#c5d4ee]'>Total sentences: 248 • Avg speed: 145 words/min</p>
          </div>
          <div className='rounded-lg border border-[#10B981]/40 bg-[#082d2a]/70 p-2 text-xs text-[#9ff6d5]'>
            <IconCircleCheckFilled className='mr-1 inline size-3.5' />
            Meeting analyzed successfully. AI confidence is high.
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function CalendarScreen() {
  return (
    <section className='space-y-4'>
      <Card className={SURFACE}>
        <CardHeader className='flex-row items-center justify-between'>
          <CardTitle className='text-[#F1F5F9]'>Google Calendar</CardTitle>
          <Badge className='bg-[#10B981] text-white'>Connected</Badge>
        </CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-sm text-[#c5d4ee]'>john@company.com</p>
          <div className='space-y-2'>
            {calendarEvents.map((event) => (
              <div key={event.id} className='rounded-lg border border-[#334155]/70 bg-[#0F172A]/70 p-3'>
                <p className='text-sm font-semibold text-[#F1F5F9]'>{event.title}</p>
                <p className='text-xs text-[#94A3B8]'>{event.time}</p>
                <p className='text-xs text-[#94A3B8]'>{event.location}</p>
                <p className='mt-2 text-xs text-[#c5d4ee]'>{event.note}</p>
                <div className='mt-2 flex gap-2'>
                  <Button size='sm' variant='outline' className='border-[#334155] text-[#F1F5F9]'>
                    Start Recording
                  </Button>
                  {event.recurring ? (
                    <Button size='sm' variant='ghost' className='text-[#c5d4ee]'>
                      Auto-Record
                    </Button>
                  ) : (
                    <Button size='sm' variant='ghost' className='text-[#c5d4ee]'>
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
        <TabsList className='rounded-xl border border-[#334155]/70 bg-[#0f1d3f]/70 p-1'>
          <TabsTrigger value='general'>General</TabsTrigger>
          <TabsTrigger value='audio'>Audio</TabsTrigger>
          <TabsTrigger value='ai'>AI Preferences</TabsTrigger>
          <TabsTrigger value='integrations'>Integrations</TabsTrigger>
          <TabsTrigger value='privacy'>Privacy</TabsTrigger>
        </TabsList>
        <TabsContent value='general'>
          <Card className={SURFACE}>
            <CardContent className='space-y-2'>
              <p className='text-sm text-[#c5d4ee]'>Language: English</p>
              <p className='text-sm text-[#c5d4ee]'>Time format: 12h</p>
              <p className='text-sm text-[#c5d4ee]'>Theme control available in top-right toggle.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value='audio'>
          <Card className={SURFACE}>
            <CardContent className='space-y-2'>
              <p className='text-sm text-[#c5d4ee]'>Input device: MacBook Microphone</p>
              <p className='text-sm text-[#c5d4ee]'>Noise suppression: Enabled</p>
              <p className='text-sm text-[#c5d4ee]'>Echo cancellation: Enabled</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value='ai'>
          <Card className={SURFACE}>
            <CardContent className='space-y-2'>
              <p className='text-sm text-[#c5d4ee]'>Summary length: Detailed</p>
              <p className='text-sm text-[#c5d4ee]'>Action item sensitivity: Balanced</p>
              <p className='text-sm text-[#c5d4ee]'>Response style: Explanatory</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value='integrations'>
          <div className='space-y-3'>
            <Card className={SURFACE}>
              <CardHeader className='flex-row items-center justify-between'>
                <CardTitle className='text-[#F1F5F9]'>
                  <IconMail className='mr-2 inline size-4' />
                  Gmail
                </CardTitle>
                <Badge className='bg-[#10B981] text-white'>Connected</Badge>
              </CardHeader>
              <CardContent className='space-y-1 text-sm text-[#c5d4ee]'>
                <p>Auto-generate follow-up emails</p>
                <p>Include transcript attachment</p>
                <p>Smart recipient detection</p>
              </CardContent>
            </Card>
            <Card className={SURFACE}>
              <CardHeader className='flex-row items-center justify-between'>
                <CardTitle className='text-[#F1F5F9]'>
                  <IconBrandSlack className='mr-2 inline size-4' />
                  Slack
                </CardTitle>
                <Badge className='bg-[#10B981] text-white'>Connected</Badge>
              </CardHeader>
              <CardContent className='space-y-1 text-sm text-[#c5d4ee]'>
                <p>Default channel: #product-team</p>
                <p>Summary schedule: End of day (6:00 PM)</p>
                <p>Thread summaries by meeting</p>
              </CardContent>
            </Card>
            <Card className={SURFACE}>
              <CardHeader className='flex-row items-center justify-between'>
                <CardTitle className='text-[#F1F5F9]'>
                  <IconCalendarEvent className='mr-2 inline size-4' />
                  Google Calendar
                </CardTitle>
                <Badge className='bg-[#10B981] text-white'>Connected</Badge>
              </CardHeader>
              <CardContent className='space-y-1 text-sm text-[#c5d4ee]'>
                <p>Show upcoming meetings in app</p>
                <p>Pre-meeting reminders: 5 minutes</p>
                <p>Sync frequency: Every 15 minutes</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value='privacy'>
          <Card className={SURFACE}>
            <CardContent className='space-y-2'>
              <p className='text-sm text-[#c5d4ee]'>Data retention: 90 days</p>
              <p className='text-sm text-[#c5d4ee]'>Auto-delete old meetings: Off</p>
              <p className='text-sm text-[#c5d4ee]'>Export all data available from dashboard exports.</p>
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
    <div className='fixed right-4 bottom-4 z-40 w-80 rounded-2xl border border-[#3B82F6]/40 bg-[linear-gradient(140deg,rgba(30,58,138,0.35),rgba(15,23,42,0.9))] p-3 shadow-[0_18px_45px_rgba(30,58,138,0.45)] backdrop-blur-xl'>
      <p className='mb-1 text-sm font-semibold text-[#F1F5F9]'>AI Meeting Copilot</p>
      <p className='text-sm text-[#dbe8ff]'>🔴 Recording {mm}:{ss}</p>
      <p className='mt-1 text-xs text-[#94A3B8]'>Product Sync Meeting</p>
      <div className='mt-2 flex gap-2'>
        <Button size='sm' variant='outline' className='border-[#3B82F6]/70 text-white' onClick={onAsk}>
          Ask AI
        </Button>
        <Button
          size='sm'
          variant='outline'
          className='border-[#334155] bg-[#0F172A]/60 text-[#F1F5F9]'
          onClick={onPauseResume}
        >
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

    const desktopApi = globalThis.window.desktop;
    if (runtimeMode === 'desktop' && desktopApi) {
      void desktopApi.recording
        .start()
        .then((state) => {
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

  return (
    <div className='relative min-h-dvh overflow-hidden bg-[#050A1A] text-slate-100'>
      <div className='pointer-events-none absolute -top-24 -left-24 size-80 rounded-full bg-[#1E3A8A]/35 blur-3xl' />
      <div className='pointer-events-none absolute top-20 right-0 size-[26rem] rounded-full bg-[#3B82F6]/20 blur-3xl' />
      <div className='pointer-events-none absolute bottom-0 left-1/3 size-[30rem] rounded-full bg-[#06B6D4]/12 blur-3xl' />
      <div className='mx-auto flex min-h-dvh max-w-[1800px]'>
        <AppSidebar
          activeView={view}
          onNavigate={setView}
          onStartRecording={startRecording}
          selectedMeeting={selectedMeeting}
        />
        <div className='flex min-h-dvh flex-1 flex-col'>
          <header className='sticky top-0 z-20 border-b border-[#334155]/60 bg-[#060b1d]/85 backdrop-blur'>
            <div className='flex items-center justify-between px-5 py-4'>
              <div>
                <h1 className='text-lg font-semibold text-[#F1F5F9]'>Dashboard</h1>
                <p className='text-xs text-[#94A3B8]'>
                  Real-time transcription, intelligence, and meeting follow-up automation.
                </p>
              </div>
              <div className='flex items-center gap-3'>
                <Badge variant='outline' className='border-[#06B6D4]/60 bg-[#0b2740] text-[#67e8f9]'>
                  <IconBolt className='mr-1 size-3.5' />
                  Live AI
                </Badge>
                <Badge variant='outline' className='border-[#334155] bg-[#0F172A]/80 text-[#c5d4ee]'>
                  {runtimeMode === 'desktop' ? `Desktop${desktopPlatform ? ` · ${desktopPlatform}` : ''}` : 'Web Preview'}
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
              <DetailScreen
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
            {view === 'calendar' && <CalendarScreen />}
            {view === 'settings' && <SettingsScreen />}
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
