import * as React from 'react';
import 'react-day-picker/style.css';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

import { cn } from '@/lib/utils';

export type { DateRange } from 'react-day-picker';

/**
 * Themed react-day-picker wrapper. Uses the library's base stylesheet but maps
 * its CSS variables onto the app's theme tokens so it matches light/dark mode.
 * Pass `mode="range"` + `selected`/`onSelect` for range selection.
 */
export function Calendar({ className, style, ...props }: DayPickerProps) {
  return (
    <DayPicker
      className={cn('text-foreground', className)}
      style={
        {
          '--rdp-accent-color': 'var(--primary)',
          '--rdp-accent-background-color': 'var(--accent)',
          '--rdp-today-color': 'var(--primary)',
          '--rdp-range_middle-background-color': 'var(--accent)',
          '--rdp-range_middle-color': 'var(--accent-foreground)',
          ...style,
        } as React.CSSProperties
      }
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <IconChevronLeft className='size-4' />
          ) : (
            <IconChevronRight className='size-4' />
          ),
      }}
      {...props}
    />
  );
}
