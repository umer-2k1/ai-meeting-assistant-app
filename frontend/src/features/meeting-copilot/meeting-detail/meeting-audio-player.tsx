import { useCallback, useEffect, useRef, useState } from 'react';

import {
  IconMusicOff,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipBack,
  IconPlayerSkipForward
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type MeetingAudioPlayerProps = {
  durationSeconds: number;
  audioUrl?: string;
  className?: string;
};

export default function MeetingAudioPlayer({
  durationSeconds,
  audioUrl,
  className
}: MeetingAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const effectiveDurationRef = useRef(Math.max(0.01, durationSeconds > 0 ? durationSeconds : 1));

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [effectiveDuration, setEffectiveDuration] = useState(() => effectiveDurationRef.current);
  const [rateIndex, setRateIndex] = useState(1);

  const playbackRate = PLAYBACK_RATES[rateIndex] ?? 1;

  const clampTime = useCallback((t: number, max?: number) => {
    const cap = max ?? effectiveDurationRef.current;
    return Math.min(Math.max(0, t), cap);
  }, []);

  const applyDurationFromAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const d = audio.duration;
    if (Number.isFinite(d) && d > 0) {
      effectiveDurationRef.current = d;
      setEffectiveDuration(d);
    } else {
      const fallback = Math.max(0.01, durationSeconds > 0 ? durationSeconds : 1);
      effectiveDurationRef.current = fallback;
      setEffectiveDuration(fallback);
    }
  }, [durationSeconds]);

  useEffect(() => {
    const fallback = Math.max(0.01, durationSeconds > 0 ? durationSeconds : 1);
    effectiveDurationRef.current = fallback;
    setEffectiveDuration(fallback);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [audioUrl, durationSeconds]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const onTimeUpdate = () => {
      setCurrentTime(clampTime(audio.currentTime));
    };
    const onEnded = () => {
      setIsPlaying(false);
      const d = audio.duration;
      const end = Number.isFinite(d) && d > 0 ? d : effectiveDurationRef.current;
      setCurrentTime(end);
    };
    const onLoadedMetadata = () => {
      applyDurationFromAudio();
      setCurrentTime(clampTime(audio.currentTime));
    };
    const onDurationChange = () => {
      applyDurationFromAudio();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);

    if (audio.readyState >= 1) {
      applyDurationFromAudio();
    }

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
    };
  }, [audioUrl, applyDurationFromAudio, clampTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = async () => {
    const audio = audioRef.current;

    if (audioUrl && audio) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        try {
          await audio.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      }
      return;
    }

    setIsPlaying((prev) => !prev);
  };

  const seekSeconds = (seconds: number) => {
    const next = clampTime(seconds);
    setCurrentTime(next);
    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = next;
    }
  };

  const skip = (delta: number) => {
    seekSeconds(currentTime + delta);
  };

  const rangeMax = Math.max(0.01, effectiveDuration);
  const rangeValue = clampTime(currentTime, rangeMax);
  const progress = rangeMax > 0 ? (rangeValue / rangeMax) * 100 : 0;

  // No saved recording — show a clean, honest empty state instead of a fake
  // "demo" player. (Meetings created before audio capture, imported without a
  // stored file, or seed data have a transcript but no audio to play.)
  if (!audioUrl) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3',
          className
        )}
      >
        <span className='inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'>
          <IconMusicOff className='size-4' />
        </span>
        <div className='min-w-0'>
          <p className='text-sm font-medium text-foreground'>No recording available</p>
          <p className='text-xs text-muted-foreground'>
            This meeting has a transcript but no saved audio. New recordings and imported
            audio are stored for playback.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-3',
        className
      )}
    >
      <audio key={audioUrl} ref={audioRef} src={audioUrl} preload='metadata' playsInline />

      <Button
        type='button'
        size='icon'
        variant='ghost'
        className='size-9 shrink-0 rounded-full'
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={() => void togglePlay()}
      >
        {isPlaying ? <IconPlayerPause className='size-5' /> : <IconPlayerPlay className='size-5' />}
      </Button>

      {/* Current time · scrubber · total on one line so the bar shares a single
          centerline with the play / speed / skip controls (times stacked below
          made this column taller and pushed the bar above the buttons). */}
      <div className='flex min-w-0 flex-1 items-center gap-2.5'>
        <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
          {formatTime(currentTime)}
        </span>
        {/* Layered scrubber: a transparent native range on top drives all
            interaction (drag / click-to-seek / keyboard / touch / a11y), while
            the visible track, played-fill, and handle underneath are painted
            from React state so the played vs. remaining split is always clear. */}
        <div className='group relative flex h-4 flex-1 items-center'>
          <div className='h-1.5 w-full overflow-hidden rounded-full bg-border'>
            <div
              className='h-full rounded-full bg-primary'
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Transparent range comes before the handle so Tailwind's `peer`
              focus-visible variant can drive the handle's keyboard focus halo. */}
          <input
            type='range'
            min={0}
            max={rangeMax}
            step={0.01}
            value={rangeValue}
            onInput={(e) => seekSeconds(Number(e.currentTarget.value))}
            onChange={(e) => seekSeconds(Number(e.currentTarget.value))}
            className='peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0'
            aria-label='Playback position'
          />
          <span
            aria-hidden='true'
            className='pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm transition-[width,height] duration-150 group-hover:size-3.5 peer-focus-visible:shadow-[0_0_0_3px_var(--copilot-accent-muted)]'
            style={{ left: `${progress}%` }}
          />
        </div>
        <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
          {formatTime(effectiveDuration)}
        </span>
      </div>

      <Button
        type='button'
        size='sm'
        variant='outline'
        // Fixed width + centered so "0.75x"/"1.25x" never reflow the slider.
        className='w-14 shrink-0 justify-center rounded-full px-0 text-xs tabular-nums'
        aria-label={`Playback speed ${playbackRate}x`}
        onClick={() => setRateIndex((i) => (i + 1) % PLAYBACK_RATES.length)}
      >
        {playbackRate}x
      </Button>

      <div className='flex shrink-0 gap-0.5'>
        <Button
          type='button'
          size='icon'
          variant='ghost'
          className='size-8'
          aria-label='Skip back 15 seconds'
          onClick={() => skip(-15)}
        >
          <IconPlayerSkipBack className='size-4' />
        </Button>
        <Button
          type='button'
          size='icon'
          variant='ghost'
          className='size-8'
          aria-label='Skip forward 15 seconds'
          onClick={() => skip(15)}
        >
          <IconPlayerSkipForward className='size-4' />
        </Button>
      </div>

    </div>
  );
}
