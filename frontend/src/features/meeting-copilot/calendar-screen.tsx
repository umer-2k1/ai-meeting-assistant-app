import { useMemo, useState, useEffect, useCallback, useRef } from 'react';

import {
  IconBell,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconLink,
  IconMapPin,
  IconMicrophone,
  IconRefresh,
  IconRepeat,
  IconSparkles,
  IconUsers,
  IconVideo
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, type DateRange } from '@/components/ui/calendar';
import { addDays, format } from 'date-fns';
import { cn } from '@/lib/utils';

import { COPILOT_BTN_OUTLINE, COPILOT_HIGHLIGHT_PANEL, COPILOT_SURFACE } from './copilot-styles';
import { BrandLoader } from '@/components/brand/brand-loader';
import { SettingsSwitch } from './settings-ui';
import type { CalendarEvent } from './types';

function parseDayLabel(event: CalendarEvent): string {
  if (event.dayLabel) return event.dayLabel;
  if (event.time.startsWith('Tomorrow')) return 'Tomorrow';
  return 'Today';
}

function formatTodayHeading() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date());
}

/**
 * Open a meeting link in the real browser (desktop) or a new tab (web).
 *
 * http(s) only: the URL comes from third-party calendar data, and it reaches
 * shell.openExternal on the desktop — which would happily launch a file:// or
 * custom-scheme target. Anything else is dropped.
 */
function openMeetingLink(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    console.warn('[calendar] ignoring unparseable meeting link', rawUrl);
    return;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    console.warn('[calendar] refusing non-http(s) meeting link', url.protocol);
    return;
  }

  const desktop = globalThis.window.desktop;
  if (desktop?.auth?.openExternal) {
    void desktop.auth.openExternal(url.href);
    return;
  }
  globalThis.window.open(url.href, '_blank', 'noopener,noreferrer');
}

function CalendarConnectionCard({
  connected,
  email,
  connecting,
  needsReconnect,
  syncing,
  onConnect,
  onCancelConnect,
  onSync,
  onManage
}: {
  connected: boolean;
  email?: string;
  connecting: boolean;
  needsReconnect?: boolean;
  syncing?: boolean;
  onConnect: () => void;
  onCancelConnect: () => void;
  onSync: () => void;
  onManage: () => void;
}) {
  return (
    <div
      className={cn(
        COPILOT_SURFACE,
        'flex flex-wrap items-center gap-4 px-5 py-4'
      )}
    >
      <div className='inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#4285F4] text-white'>
        <IconCalendarEvent className='size-5' stroke={1.75} />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <p className='text-sm font-semibold text-foreground'>Google Calendar</p>
          {connected ? (
            <Badge
              variant='outline'
              className='rounded-full border-emerald-500/40 bg-emerald-500/10 px-2 py-0 text-[11px] font-medium text-emerald-700 dark:text-emerald-300'
            >
              Connected
            </Badge>
          ) : needsReconnect ? (
            <Badge
              variant='outline'
              className='rounded-full border-destructive/40 bg-destructive/10 px-2 py-0 text-[11px] font-medium text-destructive'
            >
              Reconnect required
            </Badge>
          ) : (
            <Badge
              variant='outline'
              className='rounded-full border-amber-500/40 bg-amber-500/10 px-2 py-0 text-[11px] font-medium text-amber-800 dark:text-amber-200'
            >
              Not connected
            </Badge>
          )}
        </div>
        <p className='mt-0.5 text-sm text-muted-foreground'>
          {connected
            ? (email ?? 'Synced with your Google account')
            : needsReconnect
              ? 'Google access expired or was revoked. Reconnect to restore your calendar.'
              : 'Connect Google Calendar in Settings to see your meetings here.'}
        </p>
      </div>
      <div className='flex shrink-0 flex-wrap gap-2'>
        {connected ? (
          <>
            <Button
              size='sm'
              variant='outline'
              className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
              onClick={onSync}
              disabled={syncing}
            >
              <IconRefresh className={cn('mr-1.5 size-3.5', syncing && 'animate-spin')} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button size='sm' variant='ghost' className='rounded-full text-muted-foreground' onClick={onManage}>
              Manage
            </Button>
          </>
        ) : (
          <>
            <Button
              size='sm'
              className='rounded-full bg-primary/90 text-primary-foreground hover:bg-primary'
              onClick={onConnect}
              disabled={connecting}
            >
              {connecting ? 'Connecting…' : needsReconnect ? 'Reconnect' : 'Connect'}
            </Button>
            {connecting ? (
              <Button
                size='sm'
                variant='ghost'
                className='rounded-full text-muted-foreground'
                onClick={onCancelConnect}
              >
                Cancel
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function CalendarStat({
  label,
  value,
  hint,
  icon: Icon
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof IconClock;
}) {
  return (
    <div className={cn(COPILOT_SURFACE, 'px-4 py-3')}>
      <div className='mb-2 flex items-center gap-2'>
        <Icon className='size-4 text-primary' />
        <p className='text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase'>
          {label}
        </p>
      </div>
      <p className='text-xl font-semibold text-foreground'>{value}</p>
      <p className='mt-0.5 text-xs text-muted-foreground'>{hint}</p>
    </div>
  );
}

type PrepHandler = (ctx: NonNullable<CalendarEvent['prep']>) => void;

function NextMeetingHero({
  event,
  autoRecord,
  onAutoRecordChange,
  onStartRecording,
  onPrepare
}: {
  event: CalendarEvent;
  autoRecord: boolean;
  onAutoRecordChange: (enabled: boolean) => void;
  onStartRecording: () => void;
  onPrepare?: PrepHandler;
}) {
  return (
    <article className={cn(COPILOT_HIGHLIGHT_PANEL, 'overflow-hidden p-5')}>
      <div className='mb-3 flex flex-wrap items-center gap-2'>
        <Badge className='rounded-full border-0 bg-[#EF4444]/20 text-[11px] font-medium text-[#FCA5A5]'>
          Next up
        </Badge>
        {event.startsSoon && (
          <Badge variant='outline' className='rounded-full border-amber-500/40 text-amber-700 dark:text-amber-300'>
            Starting soon
          </Badge>
        )}
      </div>
      <h2 className='text-lg font-semibold text-foreground'>{event.title}</h2>
      <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground'>
        <span className='inline-flex items-center gap-1.5'>
          <IconClock className='size-4 text-primary' />
          {event.startTime && event.endTime
            ? `${event.startTime} – ${event.endTime}`
            : event.time}
        </span>
        <span className='inline-flex items-center gap-1.5'>
          <IconMapPin className='size-4' />
          {event.location}
        </span>
        {event.attendees != null && (
          <span className='inline-flex items-center gap-1.5'>
            <IconUsers className='size-4' />
            {event.attendees} attendees
          </span>
        )}
      </div>
      <p className='mt-3 text-sm text-foreground/85'>{event.note}</p>
      <div className='mt-4 flex flex-wrap items-center gap-3'>
        <Button
          className='bg-primary hover:bg-primary/90 text-white'
          onClick={onStartRecording}
        >
          <IconMicrophone className='mr-1.5 size-4' />
          Start recording
        </Button>
        {event.prep && onPrepare && (
          <Button
            variant='outline'
            className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
            size='sm'
            onClick={() => onPrepare(event.prep!)}
          >
            <IconSparkles className='mr-1.5 size-3.5' />
            Prepare
          </Button>
        )}
        {event.meetLink && (
          <Button
            variant='outline'
            className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
            size='sm'
            onClick={() => openMeetingLink(event.meetLink!)}
          >
            <IconLink className='mr-1.5 size-3.5' />
            Join meeting
          </Button>
        )}
        {event.recurring && (
          <label className='inline-flex items-center gap-2 text-sm text-muted-foreground'>
            <SettingsSwitch
              aria-label='Auto-record this series'
              checked={autoRecord}
              onCheckedChange={onAutoRecordChange}
            />
            Auto-record series
          </label>
        )}
      </div>
    </article>
  );
}

function CalendarEventCard({
  event,
  autoRecord,
  onAutoRecordChange,
  onStartRecording,
  onPrepare,
  isLast
}: {
  event: CalendarEvent;
  autoRecord: boolean;
  onAutoRecordChange: (enabled: boolean) => void;
  onStartRecording: () => void;
  onPrepare?: PrepHandler;
  isLast: boolean;
}) {
  const isVideo =
    event.location.toLowerCase().includes('zoom') ||
    event.location.toLowerCase().includes('meet') ||
    event.location.toLowerCase().includes('teams');

  return (
    <li className='relative flex gap-4 pb-6 last:pb-0'>
      {!isLast && (
        <span
          className='absolute top-10 left-[1.125rem] h-[calc(100%-1.5rem)] w-px bg-border/80'
          aria-hidden
        />
      )}
      <div className='relative z-[1] flex w-9 shrink-0 flex-col items-center pt-1'>
        <span
          className={cn(
            'size-2.5 rounded-full ring-4 ring-background',
            event.startsSoon ? 'bg-[#EF4444]' : 'bg-primary'
          )}
        />
      </div>
      <article
        className={cn(
          COPILOT_SURFACE,
          'min-w-0 flex-1 p-4 transition-colors hover:border-primary/40'
        )}
      >
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <h3 className='text-sm font-semibold text-foreground'>{event.title}</h3>
              {event.recurring && (
                <Badge variant='outline' className='rounded-full border-border/80 text-[10px]'>
                  <IconRepeat className='mr-1 size-3' />
                  Recurring
                </Badge>
              )}
            </div>
            <div className='mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground'>
              <span className='inline-flex items-center gap-1 font-medium text-foreground/90'>
                <IconClock className='size-3.5 text-primary' />
                {event.startTime && event.endTime
                  ? `${event.startTime} – ${event.endTime}`
                  : event.time.replace(/^[^:]+:\s*/, '')}
              </span>
              <span className='inline-flex items-center gap-1'>
                {isVideo ? (
                  <IconVideo className='size-3.5' />
                ) : (
                  <IconMapPin className='size-3.5' />
                )}
                {event.location}
              </span>
              {event.attendees != null && (
                <span className='inline-flex items-center gap-1'>
                  <IconUsers className='size-3.5' />
                  {event.attendees}
                </span>
              )}
            </div>
            <p className='mt-2 text-xs leading-relaxed text-muted-foreground'>{event.note}</p>
          </div>
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-2'>
          <Button
            size='sm'
            className='rounded-full bg-primary/90 text-primary-foreground hover:bg-primary'
            onClick={onStartRecording}
          >
            <IconMicrophone className='mr-1.5 size-3.5' />
            Record
          </Button>
          {event.prep && onPrepare && (
            <Button
              size='sm'
              variant='outline'
              className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
              onClick={() => onPrepare(event.prep!)}
            >
              <IconSparkles className='mr-1.5 size-3.5' />
              Prepare
            </Button>
          )}
          {event.recurring ? (
            <div className='inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1'>
              <span className='text-xs text-muted-foreground'>Auto-record</span>
              <SettingsSwitch
                aria-label={`Auto-record ${event.title}`}
                checked={autoRecord}
                onCheckedChange={onAutoRecordChange}
              />
            </div>
          ) : (
            <Button size='sm' variant='ghost' className='rounded-full text-muted-foreground'>
              <IconBell className='mr-1.5 size-3.5' />
              Remind me
            </Button>
          )}
          {isVideo && event.meetLink && (
            <Button
              size='sm'
              variant='ghost'
              className='rounded-full text-muted-foreground'
              onClick={() => openMeetingLink(event.meetLink!)}
            >
              <IconLink className='mr-1.5 size-3.5' />
              Join
            </Button>
          )}
        </div>
      </article>
    </li>
  );
}

function DayGroup({
  label,
  events,
  autoRecordById,
  setAutoRecord,
  onStartRecording,
  onPrepare,
  skipFirstIfHero
}: {
  label: string;
  events: CalendarEvent[];
  autoRecordById: Record<string, boolean>;
  setAutoRecord: (id: string, enabled: boolean) => void;
  onStartRecording: () => void;
  onPrepare?: PrepHandler;
  skipFirstIfHero?: boolean;
}) {
  const visible = skipFirstIfHero ? events.slice(1) : events;
  if (visible.length === 0) return null;

  return (
    <section className='space-y-3'>
      <h3 className='text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase'>
        {label}
      </h3>
      <ol className='list-none'>
        {visible.map((event, index) => (
          <CalendarEventCard
            key={event.id}
            event={event}
            autoRecord={autoRecordById[event.id] ?? Boolean(event.recurring)}
            onAutoRecordChange={(enabled) => {
              setAutoRecord(event.id, enabled);
            }}
            onStartRecording={onStartRecording}
            onPrepare={onPrepare}
            isLast={index === visible.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

export default function CalendarScreen({
  onStartRecording,
  onManageIntegrations,
  onPrepare
}: {
  onStartRecording: () => void;
  onManageIntegrations?: () => void;
  onPrepare?: PrepHandler;
}) {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState<string | undefined>(undefined);
  /** Grant revoked/expired — reconnecting is the only fix, so say so. */
  const [calendarNeedsReconnect, setCalendarNeedsReconnect] = useState(false);
  const [connecting, setConnecting] = useState(false);
  /** Lets the Cancel button (and unmount) abort an in-flight OAuth attempt. */
  const connectAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => connectAbortRef.current?.abort(), []);
  // `dateRange` is the *applied* window that actually drives fetching. `draftRange` is the
  // in-progress calendar selection — editing it (clicking start, then end) does NOT refetch,
  // so there's no jerk mid-selection. The user commits with the Apply button.
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: new Date(),
    to: addDays(new Date(), 30),
  }));
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(dateRange);

  // Prev/next/Today set a complete range in one shot — apply those immediately and keep the
  // calendar's draft in sync so it reflects the jumped-to window.
  const applyRange = useCallback((next: DateRange) => {
    setDraftRange(next);
    setDateRange(next);
  }, []);

  const draftReady = Boolean(draftRange?.from && draftRange?.to);
  const draftDiffersFromApplied =
    draftRange?.from?.getTime() !== dateRange?.from?.getTime() ||
    draftRange?.to?.getTime() !== dateRange?.to?.getTime();

  // Guard against overlapping fetches (rapid "Sync now" clicks, mount + poll).
  const fetchInFlight = useRef(false);

  const fetchCalendarEvents = useCallback(async () => {
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      setLoading(true);
      setError(null);

      const { getCalendarEvents } = await import('@/lib/integrations-api');

      // Fetch events for the selected date range (defaults to the next 30 days).
      const startDate = dateRange?.from ?? new Date();
      const endDate = dateRange?.to ?? addDays(startDate, 30);

      const { events } = await getCalendarEvents(startDate, endDate, 100);

      // Transform API events to CalendarEvent format
      const transformedEvents: CalendarEvent[] = events.map(event => ({
        id: event.id,
        title: event.title,
        time: `${new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${new Date(event.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        startTime: new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        endTime: new Date(event.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        location: event.meetLink || event.location || 'No location',
        meetLink: event.meetLink,
        note: event.description || '',
        startsAt: new Date(event.startTime),
        endsAt: new Date(event.endTime),
        dayLabel: getDayLabel(new Date(event.startTime)),
        attendees: event.attendees?.length,
        recurring: event.recurring,
        startsSoon: isStartingSoon(new Date(event.startTime)),
        prep: {
          title: event.title,
          description: event.description,
          attendees: (event.attendees ?? []).map((a) => ({
            name: a.name || a.email,
            email: a.email
          }))
        }
      }));

      setCalendarEvents(transformedEvents);
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
      if (err instanceof Error && err.message.includes('not connected')) {
        setError('calendar-not-connected');
      } else {
        setError('failed-to-fetch');
      }
      setCalendarEvents([]);
    } finally {
      fetchInFlight.current = false;
      setLoading(false);
    }
  }, [dateRange]);

  const refetchConnectionStatus = useCallback(async () => {
    try {
      const { getIntegrationStatus } = await import('@/lib/integrations-api');
      const status = await getIntegrationStatus();
      setCalendarConnected(status.calendar.connected);
      setCalendarEmail(status.calendar.email);
      setCalendarNeedsReconnect(Boolean(status.calendar.needsReconnect));
    } catch (err) {
      console.error('Failed to fetch calendar connection status:', err);
    }
  }, []);

  // Fetch calendar events + connection status from the backend
  useEffect(() => {
    void fetchCalendarEvents();
    void refetchConnectionStatus();

    // Poll for updates every 15 minutes
    const interval = setInterval(() => {
      void fetchCalendarEvents();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchCalendarEvents, refetchConnectionStatus]);

  const handleCancelConnect = useCallback(() => {
    connectAbortRef.current?.abort();
  }, []);

  const handleConnectCalendar = useCallback(async () => {
    connectAbortRef.current?.abort();
    const controller = new AbortController();
    connectAbortRef.current = controller;

    try {
      setConnecting(true);
      const { connectGoogleIntegration } = await import('@/lib/integrations-api');
      // Handles both web (popup) and desktop (system browser + deep link)
      // flows, resolving once the OAuth attempt has finished, is cancelled, or
      // is detected as abandoned.
      await connectGoogleIntegration('GOOGLE_CALENDAR', { signal: controller.signal });

      void refetchConnectionStatus();
      void fetchCalendarEvents();
    } catch (err) {
      console.error('Failed to initiate Google Calendar OAuth:', err);
      if (err instanceof Error && err.message === 'popup-blocked') {
        alert('Please allow popups for this site to connect Google Calendar.');
      } else {
        alert('Failed to connect Google Calendar. Please try again.');
      }
    } finally {
      if (connectAbortRef.current === controller) connectAbortRef.current = null;
      setConnecting(false);
    }
  }, [fetchCalendarEvents, refetchConnectionStatus]);
  
  // Helper function to determine day label
  function getDayLabel(date: Date): string {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
  }
  
  // Helper function to check if event is starting soon (within next hour)
  function isStartingSoon(startTime: Date): boolean {
    const now = new Date();
    const diff = startTime.getTime() - now.getTime();
    return diff > 0 && diff < 60 * 60 * 1000;
  }

  const [autoRecordById, setAutoRecordById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      calendarEvents.filter((e) => e.recurring).map((e) => [e.id, true])
    )
  );

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of calendarEvents) {
      const day = parseDayLabel(event);
      const list = map.get(day) ?? [];
      list.push(event);
      map.set(day, list);
    }
    return map;
  }, [calendarEvents]);

  const todayEvents = grouped.get('Today') ?? [];
  const tomorrowEvents = grouped.get('Tomorrow') ?? [];
  /**
   * "Next up" must never be a meeting that already ended. The loaded range can
   * start in the past (the picker defaults to a window, not to today), so
   * falling back to `calendarEvents[0]` used to surface a finished meeting and
   * offer to record it. Pick the earliest event still running or yet to start.
   */
  const nextEvent = useMemo(() => {
    const now = Date.now();
    const upcoming = calendarEvents
      .filter((e) => {
        // An event still counts while it is in progress, so prefer its end.
        const boundary = e.endsAt ?? e.startsAt;
        return boundary ? boundary.getTime() > now : false;
      })
      .sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0));

    return upcoming.find((e) => e.startsSoon) ?? upcoming[0];
  }, [calendarEvents]);
  const autoRecordCount = Object.values(autoRecordById).filter(Boolean).length;

  const setAutoRecord = (id: string, enabled: boolean) => {
    setAutoRecordById((prev) => ({ ...prev, [id]: enabled }));
  };

  if (loading) {
    return (
      <section className='space-y-5'>
        <CalendarConnectionCard
          connected={calendarConnected}
          email={calendarEmail}
          connecting={connecting}
          needsReconnect={calendarNeedsReconnect}
          onConnect={handleConnectCalendar}
          onCancelConnect={handleCancelConnect}
          syncing={loading}
          onSync={() => void fetchCalendarEvents()}
          onManage={() => onManageIntegrations?.()}
        />
        <div className='py-12'>
          <BrandLoader label='Loading your calendar…' size={48} />
        </div>
      </section>
    );
  }

  if (error === 'calendar-not-connected') {
    return (
      <section className='space-y-5'>
        <CalendarConnectionCard
          connected={calendarConnected}
          email={calendarEmail}
          connecting={connecting}
          needsReconnect={calendarNeedsReconnect}
          onConnect={handleConnectCalendar}
          onCancelConnect={handleCancelConnect}
          syncing={loading}
          onSync={() => void fetchCalendarEvents()}
          onManage={() => onManageIntegrations?.()}
        />
        <div className='py-12 text-center'>
          <IconCalendarEvent className='mx-auto size-10 text-muted-foreground/50' />
          <p className='mt-3 text-sm font-medium text-foreground'>Calendar not connected</p>
          <p className='mt-1 text-sm text-muted-foreground'>
            Connect your Google Calendar in Settings → Integrations to see your meetings here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className='space-y-5'>
      <CalendarConnectionCard
        connected={calendarConnected}
        email={calendarEmail}
        connecting={connecting}
        needsReconnect={calendarNeedsReconnect}
        syncing={loading}
        onConnect={handleConnectCalendar}
        onCancelConnect={handleCancelConnect}
        onSync={() => void fetchCalendarEvents()}
        onManage={() => onManageIntegrations?.()}
      />

      <div className='grid gap-3 sm:grid-cols-3'>
        <CalendarStat
          label='Today'
          value={String(todayEvents.length)}
          hint='Scheduled meetings'
          icon={IconCalendarEvent}
        />
        <CalendarStat
          label='Auto-record'
          value={String(autoRecordCount)}
          hint='Recurring series enabled'
          icon={IconRepeat}
        />
        <CalendarStat
          label='Next'
          value={nextEvent?.startTime ?? '—'}
          hint={nextEvent?.title ?? 'No upcoming events'}
          icon={IconClock}
        />
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-foreground'>
            {dateRange?.from
              ? `${format(dateRange.from, 'MMM d')} – ${format(dateRange.to ?? dateRange.from, 'MMM d, yyyy')}`
              : formatTodayHeading()}
          </p>
          <p className='text-xs text-muted-foreground'>
            {calendarEvents.length === 0 ? 'No meetings in range' : `${calendarEvents.length} events loaded`}
          </p>
        </div>
        <div className='inline-flex items-center gap-1 rounded-xl border border-border/70 bg-muted/50 p-1'>
          <Button
            size='icon-sm'
            variant='ghost'
            className='size-8 rounded-lg'
            aria-label='Previous week'
            onClick={() =>
              applyRange({
                from: addDays(dateRange?.from ?? new Date(), -7),
                to: addDays(dateRange?.to ?? addDays(new Date(), 30), -7),
              })
            }
          >
            <IconChevronLeft className='size-4' />
          </Button>
          <Button
            size='sm'
            variant='secondary'
            className='rounded-lg px-3 text-xs'
            onClick={() => applyRange({ from: new Date(), to: addDays(new Date(), 30) })}
          >
            Today
          </Button>
          <Button
            size='icon-sm'
            variant='ghost'
            className='size-8 rounded-lg'
            aria-label='Next week'
            onClick={() =>
              applyRange({
                from: addDays(dateRange?.from ?? new Date(), 7),
                to: addDays(dateRange?.to ?? addDays(new Date(), 30), 7),
              })
            }
          >
            <IconChevronRight className='size-4' />
          </Button>
        </div>
      </div>

      <div className={cn(COPILOT_SURFACE, 'flex flex-wrap items-start gap-4 p-4')}>
        <Calendar
          mode='range'
          numberOfMonths={1}
          selected={draftRange}
          onSelect={setDraftRange}
          defaultMonth={draftRange?.from}
        />
        <div className='flex min-w-[180px] flex-1 flex-col gap-2 text-sm text-muted-foreground'>
          <p className='font-medium text-foreground'>Pick a date range</p>
          <p>
            Select a start and end date, then hit Apply to load meetings from your connected
            Google Calendar for that window. Use the arrows to jump a week at a time.
          </p>
          <p className='text-xs text-foreground/80'>
            {draftRange?.from
              ? draftRange.to
                ? `${format(draftRange.from, 'MMM d')} – ${format(draftRange.to, 'MMM d, yyyy')}`
                : `${format(draftRange.from, 'MMM d, yyyy')} — pick an end date`
              : 'No dates selected'}
          </p>
          <div className='mt-auto flex items-center gap-2 pt-2'>
            <Button
              size='sm'
              className='rounded-full bg-primary/90 text-primary-foreground hover:bg-primary'
              disabled={!draftReady || !draftDiffersFromApplied || loading}
              onClick={() => draftRange && setDateRange(draftRange)}
            >
              Apply range
            </Button>
            {draftDiffersFromApplied && (
              <Button
                size='sm'
                variant='ghost'
                className='rounded-full text-muted-foreground'
                onClick={() => setDraftRange(dateRange)}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {nextEvent && (
        <NextMeetingHero
          event={nextEvent}
          autoRecord={autoRecordById[nextEvent.id] ?? Boolean(nextEvent.recurring)}
          onAutoRecordChange={(enabled) => {
            setAutoRecord(nextEvent.id, enabled);
          }}
          onStartRecording={onStartRecording}
          onPrepare={onPrepare}
        />
      )}

      <div className={cn(COPILOT_SURFACE, 'p-5')}>
        <div className='mb-4 flex items-center justify-between gap-2'>
          <h2 className='text-sm font-semibold text-foreground'>Upcoming</h2>
          <Badge variant='outline' className='border-border text-muted-foreground'>
            {calendarEvents.length} events
          </Badge>
        </div>

        <div className='space-y-6'>
          <DayGroup
            label='Today'
            events={todayEvents}
            autoRecordById={autoRecordById}
            setAutoRecord={setAutoRecord}
            onStartRecording={onStartRecording}
            onPrepare={onPrepare}
            skipFirstIfHero={todayEvents[0]?.id === nextEvent?.id}
          />
          <DayGroup
            label='Tomorrow'
            events={tomorrowEvents}
            autoRecordById={autoRecordById}
            setAutoRecord={setAutoRecord}
            onStartRecording={onStartRecording}
            onPrepare={onPrepare}
          />
        </div>

        {calendarEvents.length === 0 && (
          <div className='py-12 text-center'>
            <IconCalendarEvent className='mx-auto size-10 text-muted-foreground/50' />
            <p className='mt-3 text-sm font-medium text-foreground'>No upcoming meetings</p>
            <p className='mt-1 text-sm text-muted-foreground'>
              Your calendar is clear for the next 30 days.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
