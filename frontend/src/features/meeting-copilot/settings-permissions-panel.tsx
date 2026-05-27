import { useCallback, useEffect, useState } from 'react';

import {
  IconBell,
  IconCalendarEvent,
  IconCircleCheck,
  IconMicrophone,
  IconWaveSine
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  fetchDesktopPermissions,
  getWebNotificationPermission,
  openDesktopPermissionSettings,
  requestDesktopAccessibility,
  requestDesktopMicrophone,
  queryWebMicrophone,
  requestWebMicrophone,
  requestWebNotificationPermission,
  type DesktopPermissionsState,
  type PermissionSnapshot,
  type PermissionTarget
} from './permissions';

type PermissionRowConfig = {
  id: PermissionTarget;
  title: string;
  description: string;
  icon: typeof IconMicrophone;
  iconClassName: string;
  snapshot: PermissionSnapshot;
};

function PermissionRow({
  row,
  isDesktop,
  isRequesting,
  onEnable
}: {
  row: PermissionRowConfig;
  isDesktop: boolean;
  isRequesting: boolean;
  onEnable: (id: PermissionTarget) => void;
}) {
  const Icon = row.icon;
  const enabled = row.snapshot.granted;

  return (
    <div className='flex items-center gap-4 border-b border-border/60 py-4 last:border-b-0'>
      <div
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-white',
          row.iconClassName
        )}
      >
        <Icon className='size-5' stroke={1.75} />
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-semibold text-foreground'>{row.title}</p>
        <p className='mt-0.5 text-sm text-muted-foreground'>{row.description}</p>
      </div>
      {enabled ? (
        <div className='inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400'>
          <IconCircleCheck className='size-4' />
          Enabled
        </div>
      ) : (
        <Button
          size='sm'
          className='shrink-0 rounded-full px-4'
          disabled={isRequesting}
          onClick={() => {
            onEnable(row.id);
          }}
        >
          {row.snapshot.status === 'denied' && isDesktop ? 'Open Settings' : 'Enable'}
        </Button>
      )}
    </div>
  );
}

export default function SettingsPermissionsPanel({ isDesktop }: { isDesktop: boolean }) {
  const [permissions, setPermissions] = useState<DesktopPermissionsState | null>(null);
  const [webMic, setWebMic] = useState<PermissionSnapshot>({
    status: 'not-determined',
    granted: false,
    canRequest: true
  });
  const [webNotifications, setWebNotifications] = useState<PermissionSnapshot>({
    status: 'not-determined',
    granted: false
  });
  const [requestingId, setRequestingId] = useState<PermissionTarget | null>(null);

  const refresh = useCallback(async () => {
    if (isDesktop) {
      const next = await fetchDesktopPermissions();
      if (next) setPermissions(next);
      return;
    }

    setWebMic(await queryWebMicrophone());
    setWebNotifications(await getWebNotificationPermission());
  }, [isDesktop]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleEnable = async (id: PermissionTarget) => {
    setRequestingId(id);

    try {
      if (isDesktop) {
        if (id === 'microphone') {
          const current = permissions?.microphone;
          if (current?.status === 'denied') {
            await openDesktopPermissionSettings('microphone');
          } else {
            await requestDesktopMicrophone();
          }
        } else if (id === 'accessibility') {
          const current = permissions?.accessibility;
          if (current?.status === 'denied') {
            await openDesktopPermissionSettings('accessibility');
          } else {
            await requestDesktopAccessibility();
          }
        } else if (id === 'notifications') {
          await openDesktopPermissionSettings('notifications');
        }
        await refresh();
        return;
      }

      if (id === 'microphone') {
        const result = await requestWebMicrophone();
        setWebMic(result);
      } else if (id === 'notifications') {
        const result = await requestWebNotificationPermission();
        setWebNotifications(result);
      }
    } finally {
      setRequestingId(null);
    }
  };

  const micSnapshot: PermissionSnapshot = isDesktop
    ? (permissions?.microphone ?? { status: 'unknown', granted: false })
    : webMic;

  const accessibilitySnapshot: PermissionSnapshot = isDesktop
    ? (permissions?.accessibility ?? { status: 'unsupported', granted: true })
    : { status: 'unsupported', granted: true };

  const notificationSnapshot: PermissionSnapshot = isDesktop
    ? (permissions?.notifications ?? { status: 'unknown', granted: false })
    : webNotifications;

  const rows: PermissionRowConfig[] = [
    {
      id: 'microphone',
      title: 'Transcribe my voice',
      description: 'Required to capture meeting audio and generate live transcripts.',
      icon: IconMicrophone,
      iconClassName: 'bg-[#3B82F6]',
      snapshot: micSnapshot
    },
    ...(isDesktop
      ? [
          {
            id: 'accessibility' as const,
            title: 'System controls',
            description: 'Allows global shortcuts and reliable control of the floating widget.',
            icon: IconWaveSine,
            iconClassName: 'bg-violet-500',
            snapshot: accessibilitySnapshot
          }
        ]
      : []),
    {
      id: 'notifications',
      title: 'Meeting reminders',
      description: 'Get notified before scheduled meetings and when summaries are ready.',
      icon: IconBell,
      iconClassName: 'bg-amber-500',
      snapshot: notificationSnapshot
    }
  ];

  return (
    <div className='space-y-6'>
      <div className='rounded-2xl border border-border/70 bg-card/80 px-5 py-2'>
        <p className='mb-1 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase'>
          Permissions
        </p>
        {rows.map((row) => (
          <PermissionRow
            key={row.id}
            row={row}
            isDesktop={isDesktop}
            isRequesting={requestingId === row.id}
            onEnable={handleEnable}
          />
        ))}
      </div>

      <div className='rounded-2xl border border-border/70 bg-muted/30 p-5'>
        <div className='mb-2 flex items-center gap-2'>
          <IconCalendarEvent className='size-4 text-primary' />
          <p className='text-sm font-semibold text-foreground'>Notifications</p>
        </div>
        <p className='text-sm leading-relaxed text-muted-foreground'>
          You will receive a notification 1 minute before your meeting starts so you can join and
          begin recording on time. Enable microphone access before starting your first recording.
        </p>
        {isDesktop && (
          <p className='mt-3 text-xs text-muted-foreground'>
            On macOS, approve permissions in System Settings if no prompt appears. Use Open
            Settings on each permission row when access was previously denied.
          </p>
        )}
      </div>
    </div>
  );
}
