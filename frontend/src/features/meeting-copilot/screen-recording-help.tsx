import { useCallback, useEffect, useState } from 'react';

import { IconCopy } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import type { DesktopAppInfo } from '@/types/desktop';

type ScreenRecordingHelpProps = {
  isDesktop: boolean;
  onOpenSettings: () => void;
  onRequestAccess?: () => void;
  isRequesting?: boolean;
};

async function fetchDesktopAppInfo(): Promise<DesktopAppInfo | null> {
  const api = globalThis.window.desktop?.app;
  if (!api?.getInfo) {
    return null;
  }
  try {
    return await api.getInfo();
  } catch {
    return null;
  }
}

export default function ScreenRecordingHelp({
  isDesktop,
  onOpenSettings,
  onRequestAccess,
  isRequesting = false,
}: ScreenRecordingHelpProps) {
  const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }
    void fetchDesktopAppInfo().then(setAppInfo);
  }, [isDesktop]);

  const settingsAppName = appInfo?.settingsAppName ?? (appInfo?.isPackaged ? 'AI Meeting Copilot' : 'Electron');
  const isDevElectron = isDesktop && appInfo && !appInfo.isPackaged;

  const copyPath = useCallback(async () => {
    if (!appInfo?.execPath) {
      return;
    }
    try {
      await navigator.clipboard.writeText(appInfo.execPath);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [appInfo?.execPath]);

  if (!isDesktop) {
    return null;
  }

  return (
    <div className='space-y-4 rounded-xl border border-amber-500/35 bg-amber-500/5 p-4'>
      <div>
        <p className='text-sm font-semibold text-foreground'>How to enable Screen Recording on macOS</p>
        <p className='mt-1 text-sm text-muted-foreground'>
          macOS does not let you browse for an app file here. You only toggle apps that already
          requested access. Follow these steps in order:
        </p>
      </div>

      <ol className='list-decimal space-y-2 pl-5 text-sm text-muted-foreground'>
        <li>
          Click <span className='font-medium text-foreground'>Register app in macOS</span> below (or
          start the system audio test once). That makes the app appear in the list.
        </li>
        <li>
          Click <span className='font-medium text-foreground'>Open Screen Recording settings</span>.
        </li>
        <li>
          Go to <span className='font-medium text-foreground'>Privacy &amp; Security</span> →{' '}
          <span className='font-medium text-foreground'>Screen Recording</span>.
        </li>
        <li>
          Find{' '}
          <span className='rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground'>
            {settingsAppName}
          </span>{' '}
          in the list and turn the switch <span className='font-medium text-foreground'>ON</span>.
          {isDevElectron ? (
            <span className='mt-1 block text-xs'>
              In development, the app is listed as <strong>Electron</strong>, not &quot;
              {appInfo?.name ?? 'AI Meeting Copilot'}&quot;.
            </span>
          ) : null}
        </li>
        <li>
          Quit this app completely (Cmd+Q), reopen it, then click <span className='font-medium text-foreground'>Refresh</span>{' '}
          above.
        </li>
      </ol>

      {appInfo?.execPath ? (
        <div className='rounded-lg border border-border/70 bg-background/80 p-3'>
          <p className='text-xs font-medium text-foreground'>App binary (for reference)</p>
          <p className='mt-1 break-all font-mono text-[11px] text-muted-foreground'>
            {appInfo.execPath}
          </p>
          {isDevElectron ? (
            <p className='mt-2 text-xs text-muted-foreground'>
              In Finder: open the folder above, go up to <strong>Electron.app</strong>, right‑click →
              Show in Finder if you need to confirm which app macOS sees.
            </p>
          ) : null}
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='mt-2 h-8 rounded-full px-3 text-xs'
            onClick={() => {
              void copyPath();
            }}
          >
            <IconCopy className='mr-1 size-3' />
            {copied ? 'Copied' : 'Copy path'}
          </Button>
        </div>
      ) : null}

      <div className='flex flex-wrap gap-2'>
        {onRequestAccess ? (
          <Button
            type='button'
            size='sm'
            className='rounded-full'
            disabled={isRequesting}
            onClick={onRequestAccess}
          >
            {isRequesting ? 'Requesting…' : 'Register app in macOS'}
          </Button>
        ) : null}
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='rounded-full'
          onClick={onOpenSettings}
        >
          Open Screen Recording settings
        </Button>
      </div>
    </div>
  );
}
