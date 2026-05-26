import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  IconAdjustmentsHorizontal,
  IconArrowUp,
  IconBolt,
  IconMail,
  IconMessageCircle,
  IconMicrophone,
  IconPin,
  IconPlayerStop,
  IconSparkles
} from '@tabler/icons-react';

import { askMeetingQuestion } from '@/features/meeting-copilot/api';
import { meetings, starterTranscript } from '@/features/meeting-copilot/mock-data';
import { cn } from '@/lib/utils';

import { useWidgetWindowDrag } from './use-widget-window-drag';
import { useWidgetWindowResize } from './use-widget-window-resize';

const meeting = meetings[0];

function formatTimer(totalSeconds: number) {
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function WidgetLiveFrame({
  live,
  variant,
  className,
  children
}: {
  live: boolean;
  variant: 'pill' | 'panel';
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'widget-live-frame',
        variant === 'pill' ? 'widget-live-frame--pill' : 'widget-live-frame--panel',
        live && 'widget-live-snake',
        className
      )}
    >
      <div className='widget-live-frame__inner'>{children}</div>
    </div>
  );
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
        expanded
          ? 'border-[#06B6D4]/60 bg-[#0b2740]/80 text-[#67E8F9]'
          : 'border-[#334155] bg-[#0F172A]/60 text-[#CBD5E1] hover:border-[#3B82F6]/50 hover:text-[#F8FAFC]'
      )}
      onClick={onClick}
    >
      <IconMessageCircle className='size-4' stroke={1.75} />
    </button>
  );
}

export default function FloatingSystemWidget() {
  const [expanded, setExpanded] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [askInput, setAskInput] = useState('');
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

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
        setAskAnswer(null);
      }
    });

    return unsubscribe;
  }, []);

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
    if (!question || isAsking || !meeting) return;

    setIsAsking(true);
    try {
      const response = await askMeetingQuestion({
        meetingId: meeting.id,
        question,
        transcript: starterTranscript,
        actionItems: meeting.actionItems
      });
      setAskAnswer(response.answer);
      setAskInput('');
    } finally {
      setIsAsking(false);
    }
  };

  if (!isRecording) {
    return null;
  }

  const pillShellClass = cn(
    'flex w-full max-w-[288px] items-center justify-between gap-2 rounded-full',
    'border border-[#334155]/90 bg-[linear-gradient(140deg,rgba(30,58,138,0.42),rgba(15,23,42,0.92))] backdrop-blur-xl',
    isLive && 'border-transparent'
  );

  if (!expanded) {
    return (
      <div
        className='widget-drag-handle flex h-full w-full items-center justify-center p-1'
        onPointerDown={onDragPointerDown}
      >
        <WidgetLiveFrame live={isLive} variant='pill' className='w-full max-w-[288px]'>
          <div
            className={cn('widget-drag-handle px-2 py-1.5', pillShellClass)}
            onPointerDown={onDragPointerDown}
          >
          <MessageToggleButton expanded={false} onClick={toggleExpanded} />

          <span className='min-w-[52px] text-center font-mono text-xs font-semibold tracking-wide text-[#E2E8F0]'>
            {timerLabel}
          </span>

          <div className='flex items-center gap-1'>
            <button
              type='button'
              aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
              className={cn(
                'widget-no-drag inline-flex size-7 items-center justify-center rounded-full border border-[#334155] bg-[#0F172A]/70 text-[#CBD5E1] transition hover:border-[#3B82F6]/50',
                isLive && 'border-[#3B82F6]/70 text-[#93C5FD]'
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
              className='widget-no-drag inline-flex size-7 items-center justify-center rounded-full border border-[#334155] bg-[#0F172A]/70 transition hover:border-[#EF4444]/60'
              onClick={() => {
                void stopRecording();
              }}
            >
              <span className='inline-flex size-2.5 rounded-[2px] bg-[#EF4444]' />
            </button>

            <button
              type='button'
              aria-label='Open settings'
              className='widget-no-drag inline-flex size-7 items-center justify-center rounded-full border border-[#334155] bg-[#0F172A]/70 text-[#CBD5E1] transition hover:border-[#3B82F6]/50'
              onClick={openMainApp}
            >
              <IconAdjustmentsHorizontal className='size-3.5' />
            </button>
          </div>
          </div>
        </WidgetLiveFrame>
      </div>
    );
  }

  return (
    <div className='box-border flex h-full w-full p-1.5'>
      <WidgetLiveFrame live={isLive} variant='panel' className='h-full min-h-0 w-full'>
        <div
          className={cn(
            'relative flex h-full min-h-0 w-full flex-col bg-[linear-gradient(160deg,#0B1227_0%,#050A1A_100%)]',
            isLive ? 'border border-transparent' : 'border border-[#3B82F6]/40'
          )}
        >
        <div
          className='widget-drag-handle flex shrink-0 items-center justify-between border-b border-[#334155]/70 px-4 py-3'
          onPointerDown={onDragPointerDown}
        >
          <div className='flex items-center gap-2.5'>
            <MessageToggleButton expanded onClick={toggleExpanded} />
            <div className='inline-flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#06B6D4] text-white'>
              <IconBolt className='size-4' />
            </div>
            <span className='font-mono text-sm font-semibold text-[#F1F5F9]'>{timerLabel}</span>
            {isLive && (
              <span className='rounded-full bg-[#EF4444]/20 px-2 py-0.5 text-[11px] font-medium text-[#FCA5A5]'>
                LIVE
              </span>
            )}
          </div>
          <div className='flex items-center gap-1.5'>
            <button
              type='button'
              aria-label='Pin widget'
              className='widget-no-drag inline-flex size-8 items-center justify-center rounded-full border border-[#334155] text-[#CBD5E1]'
            >
              <IconPin className='size-4' />
            </button>
            <button
              type='button'
              aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
              className='widget-no-drag inline-flex size-8 items-center justify-center rounded-full border border-[#334155] text-[#CBD5E1]'
              onClick={() => {
                void togglePause();
              }}
            >
              <IconMicrophone className='size-4' />
            </button>
            <button
              type='button'
              aria-label='Stop recording'
              className='widget-no-drag inline-flex size-8 items-center justify-center rounded-full border border-[#334155] text-[#EF4444]'
              onClick={() => {
                void stopRecording();
              }}
            >
              <IconPlayerStop className='size-4' />
            </button>
          </div>
        </div>

        <div className='widget-no-drag min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4'>
          <div className='rounded-xl border border-[#334155]/70 bg-[#0F172A]/70 p-3'>
            <p className='text-sm text-[#CBD5E1]'>Want to see last meeting highlights?</p>
            <button
              type='button'
              className='mt-2 rounded-full border border-[#334155] bg-[#111827] px-3 py-1.5 text-xs text-[#E2E8F0] hover:border-[#3B82F6]'
              onClick={() => {
                setShowHighlights(true);
              }}
            >
              Show highlights
            </button>
          </div>

          {showHighlights && meeting && (
            <>
              <div>
                <p className='text-sm font-semibold text-[#F8FAFC]'>
                  Last Meeting: {meeting.title} 📅
                </p>
              </div>

              <div className='border-l-2 border-[#3B82F6] pl-3'>
                <p className='mb-2 text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase'>
                  Highlights
                </p>
                <ul className='space-y-1.5 text-sm text-[#CBD5E1]'>
                  {meeting.decisions.map((decision) => (
                    <li key={decision}>• {decision}</li>
                  ))}
                  <li>• {meeting.summarySnippet}</li>
                </ul>
              </div>

              <div className='border-l-2 border-[#3B82F6] pl-3'>
                <p className='mb-2 text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase'>
                  Pending Action Items
                </p>
                <ul className='space-y-1.5 text-sm text-[#CBD5E1]'>
                  {meeting.actionItems.map((item) => (
                    <li key={item.id}>
                      • @{item.assignee} {item.task.toLowerCase()}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {askAnswer && (
            <div className='rounded-lg border border-[#06B6D4]/40 bg-[#0b2740]/70 p-3 text-sm text-[#dbe8ff]'>
              {askAnswer}
            </div>
          )}
        </div>

        <div className='widget-no-drag shrink-0 space-y-3 border-t border-[#334155]/70 px-4 py-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <button
              type='button'
              className='rounded-full border border-[#334155] px-3 py-1.5 text-xs text-[#E2E8F0] hover:border-[#3B82F6]/50'
              onClick={openMainApp}
            >
              Open summary 📄
            </button>
            <button
              type='button'
              className='rounded-full border border-[#334155] px-3 py-1.5 text-xs text-[#E2E8F0] hover:border-[#3B82F6]/50'
              onClick={openMainApp}
            >
              Send Email ✉️
            </button>
          </div>

          <form
            className='flex items-center gap-2 rounded-full border border-[#334155] bg-[#0F172A]/80 px-3 py-2'
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
              placeholder='Ask me a question...'
              className='flex-1 bg-transparent text-sm text-[#F8FAFC] outline-none placeholder:text-[#64748B]'
            />
            <button
              type='submit'
              disabled={isAsking}
              aria-label='Submit question'
              className='inline-flex size-8 items-center justify-center rounded-full bg-[#3B82F6] text-white disabled:opacity-60'
            >
              <IconArrowUp className='size-4' />
            </button>
          </form>

          <div className='flex items-center justify-between text-[11px] text-[#64748B]'>
            <span className='inline-flex items-center gap-1'>
              <IconSparkles className='size-3.5' />
              AI Meeting Copilot
            </span>
            <span className='inline-flex items-center gap-1'>
              <IconMail className='size-3.5' />
              Commands ⌘K
            </span>
          </div>
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
          className='widget-resize-handle widget-resize-corner widget-no-drag absolute right-0 bottom-0 flex size-5 items-end justify-end p-1 text-[#64748B]'
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
      </WidgetLiveFrame>
    </div>
  );
}
