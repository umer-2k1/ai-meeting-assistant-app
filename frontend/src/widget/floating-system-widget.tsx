import { useEffect, useMemo, useRef, useState } from 'react';

import {
  IconAdjustmentsHorizontal,
  IconArrowUp,
  IconMessageCircle,
  IconMicrophone,
  IconPin,
  IconPlayerStop
} from '@tabler/icons-react';

import { askMeetingQuestion } from '@/features/meeting-copilot/api';
import { fetchMeetings } from '@/features/meeting-copilot/meetings-api';
import type { Meeting } from '@/features/meeting-copilot/types';
import { cn } from '@/lib/utils';
import type { TranscriptLine } from '@/features/meeting-copilot/types';
import { BrandMark } from '@/components/brand/brand-mark';

import { useWidgetThemeSync } from './use-widget-theme-sync';
import { useWidgetWindowDrag } from './use-widget-window-drag';
import { useWidgetWindowResize } from './use-widget-window-resize';

function formatTimer(totalSeconds: number) {
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function MessageToggleButton({
  expanded,
  onClick
}: {
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      aria-label={expanded ? 'Collapse chat' : 'Open chat'}
      aria-pressed={expanded}
      className={cn(
        'widget-no-drag inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition',
        expanded ? 'widget-message-btn widget-message-btn--active' : 'widget-message-btn'
      )}
      onClick={onClick}
    >
      <IconMessageCircle className='size-4' stroke={1.75} />
    </button>
  );
}

export default function FloatingSystemWidget() {
  useWidgetThemeSync();

  const [expanded, setExpanded] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [askInput, setAskInput] = useState('');
  const [askThread, setAskThread] = useState<{ id: string; q: string; a: string }[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interimLine, setInterimLine] = useState<TranscriptLine | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  // Load the most recent meeting for the highlights panel + Ask AI context.
  useEffect(() => {
    void fetchMeetings()
      .then((list) => setMeeting(list[0] ?? null))
      .catch(() => setMeeting(null));
  }, []);

  const timerLabel = useMemo(() => formatTimer(elapsedSeconds), [elapsedSeconds]);
  const isLive = isRecording && !isPaused;
  const { onPointerDown: onDragPointerDown } = useWidgetWindowDrag();
  const cornerResize = useWidgetWindowResize('corner');
  const rightResize = useWidgetWindowResize('right');
  const bottomResize = useWidgetWindowResize('bottom');

  useEffect(() => {
    const desktopApi = globalThis.window.desktop;
    if (!desktopApi) return;

    void desktopApi.recording
      .getStatus()
      .then((state) => {
        setIsRecording(state.isRecording);
        setIsPaused(state.isPaused);
        setElapsedSeconds(state.elapsedSeconds);
      })
      .catch(() => undefined);

    const unsubscribe = desktopApi.recording.onStateChange((state) => {
      setIsRecording(state.isRecording);
      setIsPaused(state.isPaused);
      setElapsedSeconds(state.elapsedSeconds);

      if (!state.isRecording) {
        setExpanded(false);
        setShowHighlights(false);
        setAskThread([]);
        setTranscript([]);
        setInterimLine(null);
      }
    });

    return unsubscribe;
  }, []);

  // Live transcript mirrored from the capturing window (main app) over IPC.
  useEffect(() => {
    const desktopApi = globalThis.window.desktop;
    if (!desktopApi) return;

    return desktopApi.recording.onTranscript((line) => {
      const uiLine: TranscriptLine = {
        id: line.id,
        speaker: line.speaker,
        text: line.text,
        timestamp: line.timestamp,
      };
      if (line.isFinal) {
        setInterimLine(null);
        setTranscript((cur) =>
          cur.some((l) => l.id === uiLine.id) ? cur : [...cur, uiLine]
        );
      } else {
        setInterimLine(uiLine);
      }
    });
  }, []);

  // Keep the newest line in view as the transcript grows. Scroll the transcript
  // container itself (not scrollIntoView, which can nudge the whole widget).
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript, interimLine, expanded]);

  useEffect(() => {
    const desktopApi = globalThis.window.desktop;
    if (!desktopApi?.widget) return;
    void desktopApi.widget.setExpanded(expanded);
  }, [expanded]);

  const toggleExpanded = () => {
    setExpanded((current) => !current);
  };

  const stopRecording = async () => {
    const desktopApi = globalThis.window.desktop;
    if (!desktopApi) return;
    const state = await desktopApi.recording.stop();
    setIsRecording(state.isRecording);
    setIsPaused(state.isPaused);
    setElapsedSeconds(state.elapsedSeconds);
    setExpanded(false);
  };

  const togglePause = async () => {
    const desktopApi = globalThis.window.desktop;
    if (!desktopApi) return;
    const state = await desktopApi.recording.pauseResume();
    setIsRecording(state.isRecording);
    setIsPaused(state.isPaused);
    setElapsedSeconds(state.elapsedSeconds);
  };

  const openMainApp = () => {
    void globalThis.window.desktop?.widget.openMain();
  };

  const submitQuestion = async () => {
    const question = askInput.trim();
    if (!question || isAsking) return;

    setIsAsking(true);
    setAskInput('');
    try {
      const response = await askMeetingQuestion({
        meetingId: meeting?.id ?? '',
        question,
        transcript: meeting?.transcript ?? [],
        actionItems: meeting?.actionItems ?? []
      });
      setAskThread((cur) => [
        ...cur,
        { id: `qa-${cur.length}-${question.slice(0, 12)}`, q: question, a: response.answer }
      ]);
    } catch {
      setAskThread((cur) => [
        ...cur,
        {
          id: `qa-${cur.length}-err`,
          q: question,
          a: 'Sorry — I could not answer that right now. Try again in a moment.'
        }
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  if (!isRecording) {
    return null;
  }

  const pillShellClass = cn(
    'widget-drag-handle widget-shell-pill flex w-full items-center justify-between gap-2 rounded-full border px-2 py-1.5 backdrop-blur-xl',
    isLive ? 'border-primary/55' : 'border-border'
  );

  if (!expanded) {
    return (
      <div
        className='widget-drag-handle flex h-full w-full items-center justify-center p-1'
        onPointerDown={onDragPointerDown}
      >
        <div className={cn(pillShellClass, 'w-full max-w-[288px]')} onPointerDown={onDragPointerDown}>
          <MessageToggleButton expanded={false} onClick={toggleExpanded} />

          <span className='min-w-[52px] text-center font-mono text-xs font-semibold tracking-wide text-foreground'>
            {timerLabel}
          </span>

          <div className='flex items-center gap-1'>
            <button
              type='button'
              aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
              className={cn(
                'widget-no-drag widget-btn-icon inline-flex size-7 items-center justify-center rounded-full border transition',
                isLive && 'border-primary/70 text-primary'
              )}
              onClick={() => {
                void togglePause();
              }}
            >
              <IconMicrophone className='size-3.5' />
            </button>

            <button
              type='button'
              aria-label='Stop recording'
              className='widget-no-drag widget-btn-icon inline-flex size-7 items-center justify-center rounded-full border transition hover:border-destructive/60'
              onClick={() => {
                void stopRecording();
              }}
            >
              <span className='inline-flex size-2.5 rounded-[2px] bg-red-500' />
            </button>

            <button
              type='button'
              aria-label='Open settings'
              className='widget-no-drag widget-btn-icon inline-flex size-7 items-center justify-center rounded-full border transition'
              onClick={openMainApp}
            >
              <IconAdjustmentsHorizontal className='size-3.5' />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full w-full min-h-0 p-1'>
      <div
        className={cn(
          'widget-shell-panel relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[22px] border',
          isLive ? 'border-primary/55' : 'border-border'
        )}
      >
        <div
          className='widget-drag-handle flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3'
          onPointerDown={onDragPointerDown}
        >
          <div className='flex items-center gap-2.5'>
            <MessageToggleButton expanded onClick={toggleExpanded} />
            <BrandMark size={30} animated={isLive} />
            <span className='font-mono text-sm font-semibold text-foreground'>{timerLabel}</span>
            {isLive && (
              <span className='rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-300'>
                LIVE
              </span>
            )}
          </div>
          <div className='flex items-center gap-1.5'>
            <button
              type='button'
              aria-label='Pin widget'
              className='widget-no-drag widget-btn-icon inline-flex size-8 items-center justify-center rounded-full border'
            >
              <IconPin className='size-4' />
            </button>
            <button
              type='button'
              aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
              className='widget-no-drag widget-btn-icon inline-flex size-8 items-center justify-center rounded-full border'
              onClick={() => {
                void togglePause();
              }}
            >
              <IconMicrophone className='size-4' />
            </button>
            <button
              type='button'
              aria-label='Stop recording'
              className='widget-no-drag widget-btn-icon inline-flex size-8 items-center justify-center rounded-full border text-destructive'
              onClick={() => {
                void stopRecording();
              }}
            >
              <IconPlayerStop className='size-4' />
            </button>
          </div>
        </div>

        {/* TOP: live transcript — its own scroll region so it never fights the
            Ask-AI area below. This is the primary surface while recording. */}
        <div className='widget-no-drag flex min-h-0 flex-1 flex-col px-4 pt-4'>
          <div className='mb-2 flex shrink-0 items-center justify-between'>
            <p className='widget-text-muted text-[11px] font-semibold tracking-[0.12em] uppercase'>
              Live Transcript
            </p>
            {meeting && (
              <button
                type='button'
                className='widget-text-muted text-[11px] hover:text-foreground'
                onClick={() => setShowHighlights((v) => !v)}
              >
                {showHighlights ? 'Hide highlights' : 'Highlights'}
              </button>
            )}
          </div>

          <div
            ref={transcriptScrollRef}
            className='widget-surface-muted min-h-0 flex-1 overflow-y-auto rounded-xl border p-3'
          >
            {transcript.length === 0 && !interimLine ? (
              <p className='text-sm text-muted-foreground'>
                {isLive ? 'Listening…' : 'Paused'}
              </p>
            ) : (
              <div className='space-y-1.5 text-sm text-foreground/90'>
                {transcript.map((line) => (
                  <p key={line.id}>
                    <span className='font-medium text-primary'>{line.speaker}: </span>
                    {line.text}
                  </p>
                ))}
                {interimLine && (
                  <p className='text-foreground/60'>
                    <span className='font-medium text-primary/70'>{interimLine.speaker}: </span>
                    {interimLine.text}
                  </p>
                )}
              </div>
            )}

            {showHighlights && meeting && (
              <div className='mt-3 space-y-2 border-t border-border/60 pt-3'>
                <p className='text-xs font-semibold text-foreground'>
                  Last meeting: {meeting.title}
                </p>
                {meeting.decisions.length > 0 && (
                  <ul className='space-y-1 text-xs text-foreground/80'>
                    {meeting.decisions.slice(0, 4).map((decision) => (
                      <li key={decision}>• {decision}</li>
                    ))}
                  </ul>
                )}
                <button
                  type='button'
                  className='rounded-full border border-border bg-background px-3 py-1 text-[11px] text-foreground hover:border-primary/50'
                  onClick={openMainApp}
                >
                  Open full summary 📄
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM: Ask-AI — a dedicated Q&A thread + input, visually separated
            from the transcript so asking never disturbs the live feed. */}
        <div className='widget-no-drag flex shrink-0 flex-col gap-2 border-t border-border/70 px-4 py-3'>
          <div className='flex items-center justify-between'>
            <p className='widget-text-muted text-[11px] font-semibold tracking-[0.12em] uppercase'>
              Ask AI
            </p>
            {askThread.length > 0 && (
              <button
                type='button'
                className='widget-text-muted text-[11px] hover:text-foreground'
                onClick={() => setAskThread([])}
              >
                Clear
              </button>
            )}
          </div>

          {(askThread.length > 0 || isAsking) && (
            <div className='max-h-40 space-y-2 overflow-y-auto pr-0.5'>
              {askThread.map((qa) => (
                <div key={qa.id} className='space-y-1'>
                  <p className='text-[11px] font-medium text-muted-foreground'>{qa.q}</p>
                  <div className='rounded-lg border border-cyan-500/40 bg-primary/10 p-2.5 text-sm text-foreground'>
                    {qa.a}
                  </div>
                </div>
              ))}
              {isAsking && (
                <p className='inline-flex items-center gap-1.5 text-[11px] text-primary'>
                  <span className='inline-block size-2 animate-pulse rounded-full bg-primary' />
                  Thinking…
                </p>
              )}
            </div>
          )}

          <form
            className='widget-input-surface flex items-center gap-2 rounded-full border px-3 py-2'
            onSubmit={async (event) => {
              event.preventDefault();
              await submitQuestion();
            }}
          >
            <input
              value={askInput}
              onChange={(event) => {
                setAskInput(event.currentTarget.value);
              }}
              placeholder='Ask about this meeting…'
              className='flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground'
            />
            <button
              type='submit'
              disabled={isAsking || !askInput.trim()}
              aria-label='Submit question'
              className='inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-60'
            >
              <IconArrowUp className='size-4' />
            </button>
          </form>
        </div>

        <div
          role='separator'
          aria-orientation='vertical'
          className='widget-resize-handle widget-resize-right absolute top-14 right-0 bottom-14 w-2'
          onPointerDown={rightResize.onPointerDown}
        />
        <div
          role='separator'
          aria-orientation='horizontal'
          className='widget-resize-handle widget-resize-bottom absolute right-10 bottom-0 left-3 h-2'
          onPointerDown={bottomResize.onPointerDown}
        />
        <button
          type='button'
          aria-label='Resize widget'
          className='widget-resize-handle widget-resize-corner widget-no-drag widget-text-muted absolute right-0 bottom-0 flex size-5 items-end justify-end p-1'
          onPointerDown={cornerResize.onPointerDown}
        >
          <svg viewBox='0 0 12 12' className='size-3 opacity-80' aria-hidden>
            <path
              d='M12 12H8V10H10V8H12V12ZM12 6H10V4H8V2H6V0H12V6ZM6 12H4V10H6V8H8V6H6V12Z'
              fill='currentColor'
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
