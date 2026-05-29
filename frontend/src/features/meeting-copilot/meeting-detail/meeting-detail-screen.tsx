import { useState } from 'react';

import {
  IconBug,
  IconCopy,
  IconDotsVertical,
  IconInfoCircle,
  IconLink,
  IconMail,
  IconRefresh,
  IconShare2,
  IconSparkles,
  IconStar,
  IconStarFilled,
  IconTag,
  IconTrash,
  IconUsers
} from '@tabler/icons-react';
import { toast } from 'sonner';

import { RichTextEditor } from '@/components/editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { COPILOT_BTN_OUTLINE, COPILOT_INPUT, COPILOT_SURFACE } from '../copilot-styles';
import type { AiAnswer, Meeting } from '../types';
import MeetingAudioPlayer from './meeting-audio-player';
import MeetingExportBar from './meeting-export-bar';
import { getTagClassName } from './tag-styles';

type View = 'dashboard' | 'live' | 'detail' | 'calendar' | 'device-check' | 'settings';

function priorityVariant(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') return 'destructive' as const;
  if (priority === 'medium') return 'secondary' as const;
  return 'outline' as const;
}

function buildSummaryHtml(meeting: Meeting): string {
  if (meeting.summaryHtml) return meeting.summaryHtml;

  const decisions =
    meeting.decisions.length > 0
      ? `<ul>${meeting.decisions.map((d) => `<li>${d}</li>`).join('')}</ul>`
      : '';

  return `
    <div class="editor-callout">
      <span class="editor-callout-icon">✨</span>
      <p><em>AI-generated summary — edit formatting in the rich summary field on the meeting record.</em></p>
    </div>
    <h2>Executive summary</h2>
    <p>${meeting.aiSummary}</p>
    ${decisions ? `<h3>Key decisions</h3>${decisions}` : ''}
  `;
}

function transcriptToPlainText(m: Meeting): string {
  return m.transcript
    .map((line) => `[${line.timestamp}] ${line.speaker}\n${line.text}`)
    .join('\n\n');
}

type MeetingDetailScreenProps = {
  meeting: Meeting;
  aiAnswers: AiAnswer[];
  setView: (view: View) => void;
  detailAskInput: string;
  setDetailAskInput: (value: string) => void;
  onAskAi: (question?: string) => Promise<void>;
  isAsking: boolean;
  askError: string | null;
};

/** Shared by tab panes that fill the card and scroll internally */
const TAB_PANE =
  'mt-0 flex min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden';

export default function MeetingDetailScreen({
  meeting,
  aiAnswers,
  setView,
  detailAskInput,
  setDetailAskInput,
  onAskAi,
  isAsking,
  askError
}: MeetingDetailScreenProps) {
  const [isFavorite, setIsFavorite] = useState(meeting.isFavorite ?? false);
  const [myNotes, setMyNotes] = useState(meeting.notes);
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({});

  const displayDate = meeting.displayDate ?? meeting.startedAt;
  const audioSeconds = meeting.audioDurationSeconds ?? 60;
  const actionCount = meeting.actionItems.length;
  const speakerCount = new Set(meeting.transcript.map((l) => l.speaker)).size;

  const copyLink = async () => {
    const url = `${window.location.origin}/meetings/${meeting.id}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const shareMeeting = () => {
    toast.info('Share dialog', {
      description: 'Team sharing will connect to backend permissions (see docs/meeting-details.md).'
    });
  };

  return (
    <section className='mx-auto flex max-w-4xl min-h-0 flex-1 flex-col gap-5'>
      {/* Header */}
      <div className='shrink-0 space-y-4'>
        <button
          type='button'
          onClick={() => setView('dashboard')}
          className='text-left text-xs text-muted-foreground hover:text-foreground'
        >
          ← Back to Dashboard
        </button>

        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='min-w-0 flex-1 space-y-2'>
            <h1 className='text-2xl font-semibold tracking-tight text-foreground'>{meeting.title}</h1>
            <p className='text-sm text-muted-foreground'>
              {displayDate} · {meeting.duration}
              {meeting.participantCount > 0 && ` · ${meeting.participantCount} participants`}
            </p>
          </div>

          <div className='flex shrink-0 items-center gap-1'>
            <Button type='button' size='icon' variant='ghost' className='size-9' aria-label='Report issue'>
              <IconBug className='size-4' />
            </Button>
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='size-9'
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              onClick={() => {
                setIsFavorite((v) => !v);
                toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites');
              }}
            >
              {isFavorite ? (
                <IconStarFilled className='size-4 text-amber-400' />
              ) : (
                <IconStar className='size-4' />
              )}
            </Button>
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='size-9 text-destructive hover:text-destructive'
              aria-label='Delete meeting'
              onClick={() =>
                toast.error('Delete meeting', {
                  description: 'Destructive actions require backend confirmation.'
                })
              }
            >
              <IconTrash className='size-4' />
            </Button>
            <Button type='button' size='icon' variant='ghost' className='size-9' aria-label='More options'>
              <IconDotsVertical className='size-4' />
            </Button>
          </div>
        </div>

        {/* Tags */}
        <div className='flex flex-wrap items-center gap-2'>
          {meeting.tags.map((tag) => (
            <Badge
              key={`detail-${tag}`}
              variant='outline'
              className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', getTagClassName(tag))}
            >
              #{tag}
            </Badge>
          ))}
          <Button type='button' size='sm' variant='ghost' className='h-7 rounded-full text-muted-foreground'>
            <IconTag className='mr-1 size-3.5' />
            Add tag
          </Button>
        </div>
      </div>

      {/* Audio */}
      <MeetingAudioPlayer durationSeconds={audioSeconds} audioUrl={meeting.audioUrl} className='shrink-0' />

      {/* Primary actions */}
      <div className='flex shrink-0 flex-wrap gap-2'>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className={cn('rounded-full border-emerald-500/50 text-emerald-700 dark:text-emerald-300', COPILOT_BTN_OUTLINE)}
          onClick={shareMeeting}
        >
          <IconShare2 className='mr-1.5 size-3.5' />
          Share
        </Button>
        <Button type='button' size='sm' variant='outline' className={cn('rounded-full', COPILOT_BTN_OUTLINE)}>
          <IconMail className='mr-1.5 size-3.5' />
          Email
        </Button>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
          onClick={() => void copyLink()}
        >
          <IconLink className='mr-1.5 size-3.5' />
          Web Link
        </Button>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
          onClick={() => void copyLink()}
        >
          <IconCopy className='mr-1.5 size-3.5' />
          Copy
        </Button>
      </div>

      {/* Export destinations */}
      <MeetingExportBar meetingTitle={meeting.title} className='shrink-0' />

      {/* Tabs */}
      <Card className={cn(COPILOT_SURFACE, 'flex min-h-0 flex-1 flex-col')}>
        <CardContent className='flex min-h-0 flex-1 flex-col pt-6'>
          <Tabs defaultValue='summary' className='flex w-full min-h-0 flex-1 flex-col'>
            <TabsList
              variant='line'
              className='mb-4 h-auto w-full shrink-0 flex-wrap justify-start gap-1 border-b border-border/60 bg-transparent p-0 pb-0'
            >
              <TabsTrigger
                value='summary'
                className='rounded-none border-b-2 border-transparent px-3 pb-3 data-[state=active]:border-primary data-[state=active]:bg-transparent'
              >
                Summary
              </TabsTrigger>
              <TabsTrigger
                value='notes'
                className='rounded-none border-b-2 border-transparent px-3 pb-3 data-[state=active]:border-primary data-[state=active]:bg-transparent'
              >
                My Notes
              </TabsTrigger>
              <TabsTrigger
                value='transcript'
                className='rounded-none border-b-2 border-transparent px-3 pb-3 data-[state=active]:border-primary data-[state=active]:bg-transparent'
              >
                Transcript
              </TabsTrigger>
              <TabsTrigger
                value='actions'
                className='rounded-none border-b-2 border-transparent px-3 pb-3 data-[state=active]:border-primary data-[state=active]:bg-transparent'
              >
                Actions ({actionCount})
              </TabsTrigger>
              <TabsTrigger
                value='chat'
                className='rounded-none border-b-2 border-transparent px-3 pb-3 data-[state=active]:border-primary data-[state=active]:bg-transparent'
              >
                <IconSparkles className='mr-1.5 size-3.5' />
                AI Chat
              </TabsTrigger>
            </TabsList>

            <TabsContent value='summary' className={cn(TAB_PANE, 'overflow-y-auto overscroll-contain')}>
              <RichTextEditor
                content={buildSummaryHtml(meeting)}
                editable={false}
                showToolbar={false}
                variant='document'
                minHeight='200px'
                paneScroll
              />
            </TabsContent>

            <TabsContent value='notes' className={cn(TAB_PANE, 'overflow-y-auto overscroll-contain')}>
              <RichTextEditor
                content={myNotes}
                onChange={setMyNotes}
                placeholder='Capture your own notes, follow-ups, and ideas…'
                variant='document'
                minHeight='240px'
                paneScroll
              />
            </TabsContent>

            <TabsContent value='transcript' className={cn(TAB_PANE, 'overflow-hidden')}>
              <div className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-muted/20 shadow-sm'>
                <div className='flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/40 px-4 py-3'>
                  <p className='text-sm font-medium text-foreground'>
                    Transcript{' '}
                    <span className='font-normal text-muted-foreground'>
                      · {speakerCount} {speakerCount === 1 ? 'speaker' : 'speakers'}
                    </span>
                  </p>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      className={cn('h-8 rounded-full text-xs', COPILOT_BTN_OUTLINE)}
                      onClick={() =>
                        toast.info('Reanalyse transcript', {
                          description: 'Will re-run diarization and ASR when the pipeline is connected.'
                        })
                      }
                    >
                      <IconRefresh className='mr-1 size-3.5' />
                      Reanalyse
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      className={cn('h-8 rounded-full text-xs', COPILOT_BTN_OUTLINE)}
                      onClick={() =>
                        toast.info('Manage speakers', {
                          description: 'Rename speakers and merge profiles in a future release.'
                        })
                      }
                    >
                      <IconUsers className='mr-1 size-3.5' />
                      Manage Speakers
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      className={cn('h-8 rounded-full text-xs', COPILOT_BTN_OUTLINE)}
                      onClick={async () => {
                        await navigator.clipboard.writeText(transcriptToPlainText(meeting));
                        toast.success('Transcript copied');
                      }}
                    >
                      <IconCopy className='mr-1 size-3.5' />
                      Copy All
                    </Button>
                  </div>
                </div>

                <div className='h-0.5 w-full shrink-0 bg-primary/35' aria-hidden />

                <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3'>
                  {meeting.transcript.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>No transcript lines yet.</p>
                  ) : (
                    meeting.transcript.map((line) => (
                      <article
                        key={line.id}
                        className={cn(
                          'border-b border-border/50 py-4 last:border-b-0',
                          line.highlighted && 'border-l-2 border-l-primary bg-primary/5 pl-3'
                        )}
                      >
                        <div className='flex flex-wrap items-baseline gap-x-2 gap-y-0.5'>
                          <span className='font-mono text-[11px] tabular-nums tracking-wide text-muted-foreground'>
                            {line.timestamp}
                          </span>
                          <span className='text-sm font-medium text-primary'>{line.speaker}</span>
                        </div>
                        <p className='mt-1.5 text-[15px] leading-relaxed text-foreground/95'>{line.text}</p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value='actions' className={cn(TAB_PANE, 'space-y-2 overflow-y-auto overscroll-contain pr-0.5')}>
              {meeting.actionItems.map((item) => (
                <div
                  key={item.id}
                  className='flex items-start gap-3 rounded-lg border border-border/70 bg-muted/40 p-3'
                >
                  <Checkbox
                    checked={completedActions[item.id] ?? false}
                    onCheckedChange={(checked) => {
                      setCompletedActions((prev) => ({
                        ...prev,
                        [item.id]: checked === true
                      }));
                    }}
                    className='mt-0.5'
                    aria-label={`Mark ${item.task} complete`}
                  />
                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                      <span className='text-xs text-muted-foreground'>{item.timestamp}</span>
                      <span className='text-xs text-muted-foreground'>Due {item.due}</span>
                    </div>
                    <p
                      className={cn(
                        'mt-1 text-sm text-foreground/90',
                        completedActions[item.id] && 'text-muted-foreground line-through'
                      )}
                    >
                      @{item.assignee} — {item.task}
                    </p>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value='chat' className={cn(TAB_PANE, 'overflow-hidden')}>
              <form
                className='flex shrink-0 gap-2'
                onSubmit={async (event) => {
                  event.preventDefault();
                  await onAskAi(detailAskInput);
                  setDetailAskInput('');
                }}
              >
                <Input
                  value={detailAskInput}
                  onChange={(event) => setDetailAskInput(event.currentTarget.value)}
                  placeholder='Ask this meeting anything…'
                  className={COPILOT_INPUT}
                />
                <Button type='submit' disabled={isAsking} className='shrink-0 bg-primary text-primary-foreground'>
                  Ask
                </Button>
              </form>
              {askError && (
                <p className='inline-flex shrink-0 items-center gap-1 text-xs text-amber-600 dark:text-amber-400'>
                  <IconInfoCircle className='size-3.5' />
                  {askError}
                </p>
              )}
              <div className='mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-0.5'>
              {aiAnswers.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  Ask about decisions, speakers, or action items from this meeting.
                </p>
              ) : (
                aiAnswers.map((answer) => (
                  <div key={answer.id} className='rounded-lg border border-border/70 bg-muted/40 p-3'>
                    <p className='text-xs font-medium text-muted-foreground'>{answer.question}</p>
                    <p className='mt-1 text-sm text-foreground/90'>{answer.answer}</p>
                    <p className='mt-2 text-xs text-primary'>Jump to {answer.timestamp}</p>
                  </div>
                ))
              )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
