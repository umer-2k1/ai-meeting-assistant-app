import { useCallback, useEffect, useState } from 'react';

import type { DesktopAppInfo } from '@/types/desktop';

import { IconCopy } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';

type ScreenRecordingHelpProperties = {
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
  isRequesting = false
}: ScreenRecordingHelpProperties) {
  const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }
    void fetchDesktopAppInfo().then(setAppInfo);
  }, [isDesktop]);

  const settingsAppName =
    appInfo?.settingsAppName ?? (appInfo?.isPackaged ? 'AI Meeting Copilot' : 'Electron');
  const isDevelopmentElectron = isDesktop && appInfo && !appInfo.isPackaged;

  const copyPath = useCallback(async () => {
    if (!appInfo?.execPath) {
      return;
    }
    try {
      await navigator.clipboard.writeText(appInfo.execPath);
      setCopied(true);
      globalThis.setTimeout(() => {
        setCopied(false);
      }, 2000);
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
        <p className='text-foreground text-sm font-semibold'>
          How to enable System Audio Recording on macOS
        </p>
        <p className='text-muted-foreground mt-1 text-sm'>
          macOS does not let you browse for an app file here. You only toggle apps that already
          requested access. Follow these steps in order:
        </p>
      </div>

      <ol className='text-muted-foreground list-decimal space-y-2 pl-5 text-sm'>
        <li>
          Click <span className='text-foreground font-medium'>Register app in macOS</span> below (or
          start the system audio test once). That makes the app appear in the list.
        </li>
        <li>
          Click{' '}
          <span className='text-foreground font-medium'>Open System Audio Recording settings</span>.
        </li>
        <li>
          Go to <span className='text-foreground font-medium'>Privacy &amp; Security</span> →{' '}
          <span className='text-foreground font-medium'>Screen &amp; System Audio Recording</span>{' '}
          and find the{' '}
          <span className='text-foreground font-medium'>System Audio Recording Only</span> section.
        </li>
        <li>
          Find{' '}
          <span className='bg-muted text-foreground rounded-md px-1.5 py-0.5 font-medium'>
            {settingsAppName}
          </span>{' '}
          in that section and turn the switch{' '}
          <span className='text-foreground font-medium'>ON</span>.
          {isDevelopmentElectron ? (
            <span className='mt-1 block text-xs'>
              In development, the app is listed as <strong>Electron</strong>, not &quot;
              {appInfo?.name ?? 'AI Meeting Copilot'}&quot;.
            </span>
          ) : null}
        </li>
        <li>
          Quit this app completely (Cmd+Q), reopen it, then click{' '}
          <span className='text-foreground font-medium'>Refresh</span> above.
        </li>
      </ol>

      {appInfo?.execPath ? (
        <div className='border-border/70 bg-background/80 rounded-lg border p-3'>
          <p className='text-foreground text-xs font-medium'>App binary (for reference)</p>
          <p className='text-muted-foreground mt-1 font-mono text-[11px] break-all'>
            {appInfo.execPath}
          </p>
          {isDevelopmentElectron ? (
            <p className='text-muted-foreground mt-2 text-xs'>
              In Finder: open the folder above, go up to <strong>Electron.app</strong>, right‑click
              → Show in Finder if you need to confirm which app macOS sees.
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
          Open System Audio Recording settings
        </Button>
      </div>
    </div>
  );
}
