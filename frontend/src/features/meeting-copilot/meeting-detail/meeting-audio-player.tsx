import { useEffect, useRef, useState } from 'react';

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
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [rateIndex, setRateIndex] = useState(1);

  const playbackRate = PLAYBACK_RATES[rateIndex] ?? 1;
  const duration = audioRef.current?.duration && Number.isFinite(audioRef.current.duration)
    ? audioRef.current.duration
    : durationSeconds;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) {
      setIsPlaying((prev) => !prev);
      if (!audioUrl) {
        setCurrentTime((t) => (isPlaying ? t : Math.min(t + 1, duration)));
      }
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      await audio.play();
      setIsPlaying(true);
    }
  };

  const seek = (value: number) => {
    const next = (value / 100) * duration;
    setCurrentTime(next);
    if (audioRef.current) audioRef.current.currentTime = next;
  };

  const skip = (delta: number) => {
    const next = Math.max(0, Math.min(duration, currentTime + delta));
    setCurrentTime(next);
    if (audioRef.current) audioRef.current.currentTime = next;
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-3',
        className
      )}
    >
      {audioUrl ? <audio ref={audioRef} src={audioUrl} preload='metadata' /> : null}

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
          max={100}
          value={progress}
          onChange={(e) => seek(Number(e.currentTarget.value))}
          className='h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary'
          aria-label='Playback position'
        />
        <div className='flex justify-between text-xs text-muted-foreground tabular-nums'>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
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
          Demo playback — attach <code className='text-foreground/80'>audioUrl</code> on the meeting
          for real audio.
        </p>
      )}
    </div>
  );
}
