import { useState } from 'react';
import { IconFileTypePdf, IconMarkdown, IconMusic } from '@tabler/icons-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { COPILOT_BTN_OUTLINE } from '../copilot-styles';
import { downloadMeetingExport } from '../meetings-api';

type MeetingExportBarProps = {
  meetingId: string;
  meetingTitle: string;
  /** Recording URL — enables the Audio export when present. */
  audioUrl?: string;
  className?: string;
};

export default function MeetingExportBar({
  meetingId,
  meetingTitle,
  audioUrl,
  className,
}: MeetingExportBarProps) {
  const [busy, setBusy] = useState<'md' | 'pdf' | 'audio' | null>(null);

  const safeName = () => meetingTitle.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'meeting';

  const download = async (format: 'md' | 'pdf') => {
    setBusy(format);
    try {
      const safe = safeName();
      await downloadMeetingExport(meetingId, format, safe);
      toast.success(`Downloaded ${safe}.${format}`);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}`);
    } finally {
      setBusy(null);
    }
  };

  const downloadAudio = async () => {
    if (!audioUrl) return;
    setBusy('audio');
    try {
      const pathPart = audioUrl.split('?')[0] ?? audioUrl;
      const ext = (pathPart.split('.').pop() ?? 'webm').slice(0, 4);
      const res = await fetch(audioUrl);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${safeName()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success('Audio downloaded');
    } catch {
      // Cross-origin fetch can fail; fall back to opening the file directly.
      window.open(audioUrl, '_blank', 'noopener');
      toast.info('Opened audio in a new tab');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className='text-xs font-medium text-muted-foreground'>Export:</span>
      <Button
        type='button'
        size='sm'
        variant='outline'
        // Fixed width keeps the label swap ("Markdown" → "Exporting…") from jerking the layout.
        className={cn('w-32 justify-center rounded-full', COPILOT_BTN_OUTLINE)}
        disabled={busy !== null}
        onClick={() => void download('md')}
      >
        <IconMarkdown className='mr-1.5 size-3.5' />
        {busy === 'md' ? 'Exporting…' : 'Markdown'}
      </Button>
      <Button
        type='button'
        size='sm'
        variant='outline'
        className={cn('w-28 justify-center rounded-full', COPILOT_BTN_OUTLINE)}
        disabled={busy !== null}
        onClick={() => void download('pdf')}
      >
        <IconFileTypePdf className='mr-1.5 size-3.5' />
        {busy === 'pdf' ? 'Exporting…' : 'PDF'}
      </Button>
      {audioUrl && (
        <Button
          type='button'
          size='sm'
          variant='outline'
          className={cn('w-32 justify-center rounded-full', COPILOT_BTN_OUTLINE)}
          disabled={busy !== null}
          onClick={() => void downloadAudio()}
        >
          <IconMusic className='mr-1.5 size-3.5' />
          {busy === 'audio' ? 'Downloading…' : 'Audio'}
        </Button>
      )}
    </div>
  );
}
