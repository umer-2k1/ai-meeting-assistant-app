import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function SettingsSection({
  title,
  description,
  children,
  className
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('overflow-hidden rounded-2xl border border-border/70 bg-card/80', className)}
    >
      {(title || description) && (
        <header className='border-b border-border/60 px-5 py-4'>
          {title && <h3 className='text-sm font-semibold text-foreground'>{title}</h3>}
          {description && (
            <p className='mt-1 text-sm leading-relaxed text-muted-foreground'>{description}</p>
          )}
        </header>
      )}
      <div className='px-5 py-1'>{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  children,
  disabled
}: {
  label: string;
  description?: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 border-b border-border/60 py-4 last:border-b-0',
        disabled && 'opacity-60'
      )}
    >
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-semibold text-foreground'>{label}</p>
        {description && (
          <p className='mt-0.5 text-sm leading-relaxed text-muted-foreground'>{description}</p>
        )}
      </div>
      <div className='shrink-0'>{children}</div>
    </div>
  );
}

export function SettingsSwitch({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label': string;
}) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        onCheckedChange(!checked);
      }}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-primary bg-primary' : 'border-input bg-muted'
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow-sm transition-transform',
          checked && 'translate-x-5'
        )}
      />
    </button>
  );
}
