import { useState } from 'react';
import { IconFileTypePdf, IconMarkdown } from '@tabler/icons-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { COPILOT_BTN_OUTLINE } from '../copilot-styles';
import { downloadMeetingExport } from '../meetings-api';

type MeetingExportBarProps = {
  meetingId: string;
  meetingTitle: string;
  className?: string;
};

export default function MeetingExportBar({
  meetingId,
  meetingTitle,
  className,
}: MeetingExportBarProps) {
  const [busy, setBusy] = useState<'md' | 'pdf' | null>(null);

  const download = async (format: 'md' | 'pdf') => {
    setBusy(format);
    try {
      const safe = meetingTitle.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'meeting';
      await downloadMeetingExport(meetingId, format, safe);
      toast.success(`Downloaded ${safe}.${format}`);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}`);
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
    </div>
  );
}
