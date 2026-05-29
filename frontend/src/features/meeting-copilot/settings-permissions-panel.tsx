import { useCallback, useEffect, useState } from 'react';

import { IconBell, IconCircleCheck, IconDeviceDesktop, IconMicrophone } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  fetchPermissionCatalog,
  getDefaultPermissionCatalog,
  requestPermissionItem,
  type PermissionCatalog,
  type PermissionIconKey,
  type PermissionItem,
  type PermissionTarget,
} from './permissions';

const PERMISSION_ICONS = {
  microphone: IconMicrophone,
  systemAudio: IconDeviceDesktop,
  notifications: IconBell,
} as const;

const PERMISSION_ICON_STYLES: Record<PermissionIconKey, string> = {
  microphone: 'bg-[#3B82F6]',
  systemAudio: 'bg-emerald-600',
  notifications: 'bg-amber-500',
};

function PermissionRow({
  item,
  isRequesting,
  onAction,
}: {
  item: PermissionItem;
  isRequesting: boolean;
  onAction: (id: PermissionTarget) => void;
}) {
  const Icon = PERMISSION_ICONS[item.icon];
  const enabled = item.snapshot.granted;
  const actionLabel =
    item.action === 'openSettings' ? 'Open Settings' : item.action === 'enable' ? 'Enable' : null;

  return (
    <div className='border-b border-border/60 py-4 last:border-b-0'>
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
          <p className='text-sm font-semibold text-foreground'>{item.title}</p>
          <p className='mt-0.5 text-sm text-muted-foreground'>{item.description}</p>
        </div>
        {enabled ? (
          <div className='inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400'>
            <IconCircleCheck className='size-4' />
            Enabled
          </div>
        ) : actionLabel ? (
          <Button
            size='sm'
            className='shrink-0 rounded-full px-4'
            disabled={isRequesting}
            onClick={() => {
              onAction(item.id);
            }}
          >
            {actionLabel}
          </Button>
        ) : null}
      </div>
      {!enabled && item.helpText ? (
        <p className='mt-3 pl-14 text-xs leading-relaxed text-muted-foreground'>{item.helpText}</p>
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
      const next = await fetchPermissionCatalog(isDesktopRuntime);
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
    if (!isDesktopRuntime) return;

    const onFocus = () => {
      void refresh();
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isDesktopRuntime, refresh]);

  const handleAction = async (id: PermissionTarget) => {
    setRequestingId(id);

    try {
      await requestPermissionItem(id, catalog);
      await refresh();
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <div className='rounded-2xl border border-border/70 bg-card/80 px-5 py-2'>
      <p className='mb-1 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase'>
        Permissions
      </p>
      {catalog.items.map((item) => (
        <PermissionRow
          key={item.id}
          item={item}
          isRequesting={requestingId === item.id}
          onAction={handleAction}
        />
      ))}
    </div>
  );
}
