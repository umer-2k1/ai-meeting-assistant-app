import { useEffect, useState } from 'react';

import {
  IconCopy,
  IconInfoCircle,
  IconLink,
  IconRefresh,
  IconSparkles,
  IconTrash
} from '@tabler/icons-react';
import { toast } from 'sonner';

import { RichTextEditor } from '@/components/editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TypewriterText } from '@/components/ui/typewriter-text';
import { cn } from '@/lib/utils';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { COPILOT_BTN_OUTLINE, COPILOT_INPUT, COPILOT_SURFACE } from '../copilot-styles';
import {
  createNoteApi,
  deleteMeetingApi,
  reprocessMeetingApi,
  updateNoteApi
} from '../meetings-api';
import type { AiAnswer, Meeting } from '../types';
import MeetingAudioPlayer from './meeting-audio-player';
import MeetingExportBar from './meeting-export-bar';
import MeetingShareDialog from './meeting-share-dialog';
import { getTagClassName } from './tag-styles';

type View = 'dashboard' | 'live' | 'detail' | 'calendar' | 'device-check' | 'settings';

function priorityVariant(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') return 'destructive' as const;
  if (priority === 'medium') return 'secondary' as const;
  return 'outline' as const;
}

function buildSummaryHtml(meeting: Meeting): string {
  if (meeting.summaryHtml) return meeting.summaryHtml;

  const section = (title: string, body: string) => (body ? `<h3>${title}</h3>${body}` : '');
  const list = (items: string[]) =>
    items.length > 0 ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '';

  const decisions = list(meeting.decisions);
  const actions =
    meeting.actionItems.length > 0
      ? `<ul>${meeting.actionItems
          .map(
            (a) =>
              `<li><strong>@${a.assignee}</strong> — ${a.task}${a.due ? ` <em>(due ${a.due})</em>` : ''}</li>`
          )
          .join('')}</ul>`
      : '';

  const summaryBody = meeting.aiSummary
    ? `<p>${meeting.aiSummary}</p>`
    : '<p><em>No summary generated yet. Re-analyse this meeting to produce one.</em></p>';

  return `
    <div class="editor-callout">
      <span class="editor-callout-icon">✨</span>
      <p><em>AI-generated summary — edit formatting in the rich summary field on the meeting record.</em></p>
    </div>
    <h2>Executive summary</h2>
    ${summaryBody}
    ${section('Key decisions', decisions)}
    ${section('Action items', actions)}
  `;
}

function transcriptToPlainText(m: Meeting): string {
  return m.transcript
    .map((line) => `[${line.timestamp}] ${line.speaker}\n${line.text}`)
    .join('\n\n');
}

/**
 * Copy text with a resilient fallback. The async clipboard API rejects in some
 * Electron/insecure contexts; fall back to a hidden textarea + execCommand so a
 * copy never silently no-ops (which read as "the button does nothing").
 */
async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
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
  onDeleted: () => void;
  onReprocess: () => void;
};

/** Shared by tab panes that fill the card and scroll internally. The stable
 *  scrollbar gutter keeps every tab the exact same width whether or not its
 *  content overflows — no reflow/jump when switching tabs. */
const TAB_PANE =
  'mt-0 flex min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden [scrollbar-gutter:stable]';

export default function MeetingDetailScreen({
  meeting,
  aiAnswers,
  setView,
  detailAskInput,
  setDetailAskInput,
  onAskAi,
  isAsking,
  askError,
  onDeleted,
  onReprocess
}: MeetingDetailScreenProps) {
  const [myNotes, setMyNotes] = useState(meeting.notes);
  const [existingNoteId, setExistingNoteId] = useState<string | null>(
    meeting.meetingNotes?.[0]?.id ?? null
  );
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({});

  // Re-sync local editable state when a different meeting is loaded.
  useEffect(() => {
    setMyNotes(meeting.notes);
    setExistingNoteId(meeting.meetingNotes?.[0]?.id ?? null);
  }, [meeting.id, meeting.notes, meeting.meetingNotes]);

  const displayDate = meeting.displayDate ?? meeting.startedAt;
  const audioSeconds = meeting.audioDurationSeconds ?? 60;
  const actionCount = meeting.actionItems.length;
  const speakerCount = new Set(meeting.transcript.map((l) => l.speaker)).size;

  const copyLink = async () => {
    const url = `${window.location.origin}/meetings/${meeting.id}`;
    if (await copyTextToClipboard(url)) {
      toast.success('Link copied to clipboard');
    } else {
      toast.error('Could not copy link');
    }
  };

  const saveNotes = async () => {
    setIsSavingNotes(true);
    try {
      if (existingNoteId) {
        await updateNoteApi(existingNoteId, myNotes);
      } else {
        const note = await createNoteApi(meeting.id, myNotes);
        setExistingNoteId(note.id);
      }
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const deleteMeeting = async () => {
    setIsDeleting(true);
    try {
      await deleteMeetingApi(meeting.id);
      toast.success('Meeting deleted');
      onDeleted();
    } catch {
      toast.error('Failed to delete meeting');
    } finally {
      setIsDeleting(false);
    }
  };

  const reprocessMeeting = async () => {
    setIsReprocessing(true);
    try {
      await reprocessMeetingApi(meeting.id);
      toast.success('Re-analysis started');
      onReprocess();
    } catch {
      toast.error('Failed to start re-analysis');
    } finally {
      setIsReprocessing(false);
    }
  };

  return (
    <section className='mx-auto flex w-full max-w-4xl min-h-0 min-w-0 flex-1 flex-col gap-5'>
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
            <h1 className='text-2xl font-semibold tracking-tight text-foreground'>
              <TypewriterText text={meeting.title} />
            </h1>
            <p className='text-sm text-muted-foreground'>
              {displayDate} · {meeting.duration}
              {meeting.participantCount > 0 && ` · ${meeting.participantCount} participants`}
            </p>
          </div>

          <div className='flex shrink-0 items-center gap-1'>
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='size-9'
              aria-label='Re-analyze meeting'
              disabled={isReprocessing}
              onClick={() => void reprocessMeeting()}
            >
              <IconRefresh className={cn('size-4', isReprocessing && 'animate-spin')} />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type='button'
                  size='icon'
                  variant='ghost'
                  className='size-9 text-destructive hover:text-destructive'
                  aria-label='Delete meeting'
                  disabled={isDeleting}
                >
                  <IconTrash className='size-4' />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the transcript, summary, action items, and notes for
                    “{meeting.title}”. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className='bg-destructive text-white hover:bg-destructive/90'
                    onClick={() => void deleteMeeting()}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
        </div>
      </div>

      {/* Processing status */}
      {meeting.status === 'processing' && (
        <div className='shrink-0 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300'>
          Generating summary and action items… this can take a moment. Refresh to see results.
        </div>
      )}
      {meeting.status === 'failed' && (
        <div className='flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300'>
          <span>
            Processing failed{meeting.processingError ? `: ${meeting.processingError}` : '.'}
          </span>
          <Button
            type='button'
            size='sm'
            variant='outline'
            className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
            disabled={isReprocessing}
            onClick={() => void reprocessMeeting()}
          >
            <IconRefresh className={cn('mr-1 size-3.5', isReprocessing && 'animate-spin')} />
            Retry
          </Button>
        </div>
      )}

      {/* Audio */}
      <MeetingAudioPlayer durationSeconds={audioSeconds} audioUrl={meeting.audioUrl} className='shrink-0' />

      {/* Primary actions */}
      <div className='flex shrink-0 flex-wrap gap-2'>
        <MeetingShareDialog
          meetingId={meeting.id}
          attendeeEmails={(meeting.attendees ?? [])
            .map((a) => a.email)
            .filter((e): e is string => Boolean(e))}
        />
        <Button
          type='button'
          size='sm'
          variant='outline'
          className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
          onClick={() => void copyLink()}
        >
          <IconLink className='mr-1.5 size-3.5' />
          Copy link
        </Button>
      </div>

      {/* Export destinations */}
      <MeetingExportBar
        meetingId={meeting.id}
        meetingTitle={meeting.title}
        audioUrl={meeting.audioUrl}
        className='shrink-0'
      />

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
              <div className='mt-3 flex justify-end'>
                <Button
                  type='button'
                  size='sm'
                  className='bg-primary text-primary-foreground hover:bg-primary/90'
                  disabled={isSavingNotes}
                  onClick={() => void saveNotes()}
                >
                  {isSavingNotes ? 'Saving…' : 'Save notes'}
                </Button>
              </div>
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
                      disabled={isReprocessing}
                      onClick={() => void reprocessMeeting()}
                    >
                      <IconRefresh className={cn('mr-1 size-3.5', isReprocessing && 'animate-spin')} />
                      Reanalyse
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      className={cn('h-8 rounded-full text-xs', COPILOT_BTN_OUTLINE)}
                      onClick={async () => {
                        if (await copyTextToClipboard(transcriptToPlainText(meeting))) {
                          toast.success('Transcript copied');
                        } else {
                          toast.error('Could not copy transcript');
                        }
                      }}
                    >
                      <IconCopy className='mr-1 size-3.5' />
                      Copy All
                    </Button>
                  </div>
                </div>

                <div className='h-0.5 w-full shrink-0 bg-primary/35' aria-hidden />

                <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 [scrollbar-gutter:stable]'>
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
