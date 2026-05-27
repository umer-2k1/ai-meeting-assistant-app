import { useCallback, useEffect, useRef, useState } from 'react';

import {
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

  /** Demo playback when no file URL — advances currentTime so the slider fill matches elapsed time. */
  useEffect(() => {
    if (audioUrl || !isPlaying) return;

    const tickMs = 100;
    const id = window.setInterval(() => {
      setCurrentTime((prev) => {
        const max = effectiveDurationRef.current;
        const next = prev + tickMs / 1000;
        if (next >= max - 1e-3) {
          window.setTimeout(() => setIsPlaying(false), 0);
          return max;
        }
        return next;
      });
    }, tickMs);

    return () => clearInterval(id);
  }, [audioUrl, isPlaying]);

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

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-3',
        className
      )}
    >
      {audioUrl ? (
        <audio
          key={audioUrl}
          ref={audioRef}
          src={audioUrl}
          preload='metadata'
          playsInline
        />
      ) : null}

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

      <div className='min-w-0 flex-1 space-y-1'>
        <input
          type='range'
          min={0}
          max={rangeMax}
          step={0.01}
          value={rangeValue}
          onInput={(e) => seekSeconds(Number(e.currentTarget.value))}
          onChange={(e) => seekSeconds(Number(e.currentTarget.value))}
          className='h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary'
          aria-label='Playback position'
        />
        <div className='flex justify-between text-xs text-muted-foreground tabular-nums'>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(effectiveDuration)}</span>
        </div>
      </div>

      <Button
        type='button'
        size='sm'
        variant='outline'
        className='shrink-0 rounded-full px-2.5 text-xs tabular-nums'
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

      {!audioUrl && (
        <p className='w-full text-xs text-muted-foreground'>
          Demo playback — attach <code className='text-foreground/80'>audioUrl</code> on the meeting for
          real audio. Slider fill matches elapsed time against the meeting duration.
        </p>
      )}
    </div>
  );
}
