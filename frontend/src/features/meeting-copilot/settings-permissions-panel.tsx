import { useCallback, useEffect, useState } from 'react';

import type {
  PermissionCatalog,
  PermissionIconKey,
  PermissionItem,
  PermissionTarget
} from './permissions';

import {
  IconAccessible,
  IconCircleCheck,
  IconDeviceDesktop,
  IconMicrophone
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  fetchSettingsPermissionCatalog,
  getDefaultPermissionCatalog,
  openDesktopPermissionSettings,
  requestPermissionItem
} from './permissions';

const PERMISSION_ICONS = {
  accessibility: IconAccessible,
  microphone: IconMicrophone,
  systemAudio: IconDeviceDesktop,
  notifications: IconAccessible
} as const;

const PERMISSION_ICON_STYLES: Record<PermissionIconKey, string> = {
  accessibility: 'bg-emerald-700',
  microphone: 'bg-[#3B82F6]',
  systemAudio: 'bg-emerald-600',
  notifications: 'bg-amber-500'
};

function PermissionCard({
  item,
  isRequesting,
  onGrantAccess,
  onOpenSettings
}: {
  item: PermissionItem;
  isRequesting: boolean;
  onGrantAccess: (id: PermissionTarget) => void;
  onOpenSettings: (id: PermissionTarget) => void;
}) {
  const Icon = PERMISSION_ICONS[item.icon] ?? IconAccessible;
  const granted = item.snapshot.granted;

  return (
    <div className='border-border/70 bg-card/80 rounded-2xl border px-5 py-4'>
      <div className='flex items-center gap-4'>
        <div
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-white',
            PERMISSION_ICON_STYLES[item.icon]
          )}
        >
          <Icon className='size-5' stroke={1.75} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <p className='text-foreground text-sm font-semibold'>{item.title}</p>
            {granted ? (
              <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400'>
                <IconCircleCheck className='size-3.5' />
                Granted
              </span>
            ) : null}
          </div>
          <p className='text-muted-foreground mt-0.5 text-sm'>{item.description}</p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {granted ? (
            <Button
              size='sm'
              variant='outline'
              className='rounded-full px-4'
              disabled={isRequesting}
              onClick={() => {
                onOpenSettings(item.id);
              }}
            >
              Open Settings
            </Button>
          ) : (
            <Button
              size='sm'
              className='rounded-full bg-amber-400 px-4 text-amber-950 hover:bg-amber-300'
              disabled={isRequesting}
              onClick={() => {
                onGrantAccess(item.id);
              }}
            >
              Grant Access
            </Button>
          )}
        </div>
      </div>
      {!granted && item.helpText ? (
        <p className='text-muted-foreground mt-3 pl-14 text-xs leading-relaxed'>{item.helpText}</p>
      ) : null}
    </div>
  );
}

export default function SettingsPermissionsPanel({ isDesktop }: { isDesktop: boolean }) {
  const isDesktopRuntime = isDesktop || Boolean(globalThis.window.desktop?.permissions);
  const [catalog, setCatalog] = useState<PermissionCatalog>(() =>
    getDefaultPermissionCatalog(isDesktopRuntime ? 'darwin' : 'web')
  );
  const [requestingId, setRequestingId] = useState<PermissionTarget | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchSettingsPermissionCatalog(isDesktopRuntime);
      setCatalog(
        next.items.length > 0
          ? next
          : getDefaultPermissionCatalog(next.platform || (isDesktopRuntime ? 'darwin' : 'web'))
      );
    } catch (error) {
      console.error('[permissions] refresh failed', error);
      setCatalog(getDefaultPermissionCatalog(isDesktopRuntime ? 'darwin' : 'web'));
    }
  }, [isDesktopRuntime]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isDesktopRuntime) {
      return;
    }

    const onFocus = () => {
      void refresh();
    };

    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [isDesktopRuntime, refresh]);

  const runAction = async (id: PermissionTarget, action: 'grant' | 'settings') => {
    setRequestingId(id);

    try {
      await (action === 'settings'
        ? openDesktopPermissionSettings(id)
        : requestPermissionItem(id, catalog));
      await refresh();
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-foreground text-lg font-semibold'>System Permissions</h3>
        <p className='text-muted-foreground mt-1 text-sm'>
          The app needs these permissions to work properly. Grant access when prompted, or open
          System Settings to manage access later.
        </p>
      </div>
      <div className='space-y-3'>
        {catalog.items.map((item) => (
          <PermissionCard
            key={item.id}
            item={item}
            isRequesting={requestingId === item.id}
            onGrantAccess={(id) => void runAction(id, 'grant')}
            onOpenSettings={(id) => void runAction(id, 'settings')}
          />
        ))}
      </div>
    </div>
  );
}
