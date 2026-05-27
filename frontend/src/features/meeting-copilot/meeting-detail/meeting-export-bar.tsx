import {
  IconBrandGoogleDrive,
  IconBrandNotion,
  IconFileTypeDoc,
  IconPlus,
  IconSparkles
} from '@tabler/icons-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { COPILOT_BTN_OUTLINE } from '../copilot-styles';

type ExportDestination = {
  id: string;
  label: string;
  icon: typeof IconBrandNotion;
  connected?: boolean;
};

const DESTINATIONS: ExportDestination[] = [
  { id: 'notion', label: 'Notion', icon: IconBrandNotion, connected: true },
  { id: 'docs', label: 'Docs', icon: IconFileTypeDoc, connected: true },
  { id: 'craft', label: 'Craft', icon: IconSparkles },
  { id: 'obsidian', label: 'Obsidian', icon: IconSparkles },
  { id: 'drive', label: 'Drive', icon: IconBrandGoogleDrive, connected: true },
  { id: 'confluence', label: 'Confluence', icon: IconFileTypeDoc }
];

type MeetingExportBarProps = {
  meetingTitle: string;
  className?: string;
};

export default function MeetingExportBar({ meetingTitle, className }: MeetingExportBarProps) {
  const handleExport = (destinationId: string, label: string) => {
    toast.info(`Export to ${label}`, {
      description: `"${meetingTitle}" — integration wiring is pending. See docs/meeting-details.md.`
    });
    void destinationId;
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {DESTINATIONS.map((dest) => {
        const Icon = dest.icon;
        return (
          <Button
            key={dest.id}
            type='button'
            size='sm'
            variant='outline'
            className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
            onClick={() => handleExport(dest.id, dest.label)}
          >
            <Icon className='mr-1.5 size-3.5' />
            {dest.label}
            <span className='ml-0.5 text-muted-foreground'>+</span>
          </Button>
        );
      })}
      <Button
        type='button'
        size='sm'
        variant='outline'
        className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
        onClick={() => handleExport('all', 'Export menu')}
      >
        <IconPlus className='mr-1.5 size-3.5' />
        Export
      </Button>
    </div>
  );
}
