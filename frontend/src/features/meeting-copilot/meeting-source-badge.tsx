import { IconCalendarEvent, IconMicrophone } from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { MeetingSource } from './types';

/**
 * Where a meeting came from, at a glance.
 *
 * The distinction is not cosmetic: a CALENDAR meeting carries the invite's
 * attendees, which is what lets the pre-meeting brief find past meetings with
 * the same people. A DIRECT recording has no attendee list, so it can never
 * contribute to (or benefit from) that history.
 */
export default function MeetingSourceBadge({
  source,
  className
}: {
  source?: MeetingSource;
  className?: string;
}) {
  const isCalendar = source === 'CALENDAR';
  const Icon = isCalendar ? IconCalendarEvent : IconMicrophone;

  return (
    <Badge
      variant='outline'
      title={
        isCalendar
          ? 'Recorded from a Google Calendar event — carries the invite’s attendees'
          : 'Ad-hoc recording — not linked to a calendar event'
      }
      className={cn(
        'shrink-0 gap-1 rounded-full px-2 py-0 text-[11px] font-medium',
        isCalendar
          ? 'border-[#4285F4]/40 bg-[#4285F4]/10 text-[#1a73e8] dark:text-[#8ab4f8]'
          : 'border-border bg-muted/60 text-muted-foreground',
        className
      )}
    >
      <Icon className='size-3' stroke={1.75} />
      {isCalendar ? 'Calendar' : 'Recording'}
    </Badge>
  );
}
