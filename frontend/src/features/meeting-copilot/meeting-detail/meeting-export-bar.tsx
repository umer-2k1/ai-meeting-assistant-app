import { IconFileTypePdf, IconMarkdown, IconMusic } from '@tabler/icons-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { COPILOT_BTN_OUTLINE } from '../copilot-styles';
import { downloadMeetingExport, triggerBlobDownload } from '../meetings-api';

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
  const safeName = () => meetingTitle.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'meeting';

  // Exports open instantly and the labels are self-explanatory, so the buttons
  // stay static — no busy/"Exporting…" state (its rapid flip read as a flicker).
  // We only surface a toast when something actually goes wrong.
  const download = async (format: 'md' | 'pdf') => {
    try {
      await downloadMeetingExport(meetingId, format, safeName());
    } catch {
      toast.error(`Failed to export ${format === 'pdf' ? 'PDF' : 'Markdown'}`);
    }
  };

  const downloadAudio = async () => {
    if (!audioUrl) return;
    try {
      const pathPart = audioUrl.split('?')[0] ?? audioUrl;
      const ext = (pathPart.split('.').pop() ?? 'webm').slice(0, 4);
      const res = await fetch(audioUrl);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      triggerBlobDownload(blob, `${safeName()}.${ext}`);
    } catch {
      // Cross-origin fetch can fail; fall back to opening the file directly.
      window.open(audioUrl, '_blank', 'noopener');
      toast.info('Opened the recording in a new tab');
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className='text-xs font-medium text-muted-foreground'>Export:</span>
      <Button
        type='button'
        size='sm'
        variant='outline'
        className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
        onClick={() => void download('md')}
      >
        <IconMarkdown className='mr-1.5 size-3.5' />
        Markdown
      </Button>
      <Button
        type='button'
        size='sm'
        variant='outline'
        className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
        onClick={() => void download('pdf')}
      >
        <IconFileTypePdf className='mr-1.5 size-3.5' />
        PDF
      </Button>
      {audioUrl && (
        <Button
          type='button'
          size='sm'
          variant='outline'
          className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
          onClick={() => void downloadAudio()}
        >
          <IconMusic className='mr-1.5 size-3.5' />
          Audio
        </Button>
      )}
    </div>
  );
}
