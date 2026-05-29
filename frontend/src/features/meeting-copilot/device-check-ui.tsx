import { useEffect, useRef } from 'react';

import { IconPlayerPlay } from '@tabler/icons-react';

import { cn } from '@/lib/utils';

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) {
    return '—';
  }
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function LevelMeter({ level, peakLevel }: { level: number; peakLevel: number }) {
  const bars = 24;
  const displayLevel = Math.min(1, level * 4);
  const displayPeak = Math.min(1, peakLevel * 4);

  return (
    <div className='space-y-3'>
      <div className='flex h-28 items-end justify-center gap-1 rounded-xl border border-border/70 bg-muted/30 px-4 py-3'>
        {Array.from({ length: bars }, (_, index) => {
          const threshold = (index + 1) / bars;
          const active = displayLevel >= threshold * 0.85;
          const peakHit = displayPeak >= threshold * 0.85;

          return (
            <div
              key={index}
              className={cn(
                'w-2 rounded-full transition-all duration-75',
                active
                  ? 'bg-gradient-to-t from-[#1E3A8A] to-[#06B6D4]'
                  : peakHit
                    ? 'bg-cyan-500/35'
                    : 'bg-muted-foreground/20'
              )}
              style={{ height: `${12 + threshold * 72}%` }}
            />
          );
        })}
      </div>
      <div className='flex justify-between text-xs text-muted-foreground'>
        <span>Live level: {(level * 100).toFixed(1)}%</span>
        <span>Peak: {(peakLevel * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function AudioPreview({
  url,
  durationSec,
  autoPlay,
  title = 'Audio preview',
  description = 'Play back your recording to confirm audio was captured clearly.',
}: {
  url: string;
  durationSec: number | null;
  autoPlay?: boolean;
  title?: string;
  description?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!autoPlay || !audioRef.current) {
      return;
    }

    void audioRef.current.play().catch(() => undefined);
  }, [autoPlay, url]);

  return (
    <div className='space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-sm font-semibold text-foreground'>{title}</p>
        <span className='text-xs text-muted-foreground'>Duration: {formatDuration(durationSec)}</span>
      </div>
      <audio ref={audioRef} controls src={url} className='w-full' preload='auto'>
        <track kind='captions' />
      </audio>
      <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
        <IconPlayerPlay className='size-3.5' />
        {description}
      </p>
    </div>
  );
}

export function LiveAudioMonitor({
  stream,
  label,
}: {
  stream: MediaStream | null;
  label: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) {
      return;
    }

    if (stream) {
      el.srcObject = stream;
      void el.play().catch(() => undefined);
    } else {
      el.srcObject = null;
    }

    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  if (!stream) {
    return null;
  }

  return (
    <div className='space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4'>
      <p className='text-sm font-medium text-foreground'>{label}</p>
      <audio ref={audioRef} controls className='w-full'>
        <track kind='captions' />
      </audio>
      <p className='text-xs text-muted-foreground'>
        Live monitor — play meeting or app audio on your computer to hear it here.
      </p>
    </div>
  );
}
