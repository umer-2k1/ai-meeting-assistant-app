import { useMemo } from 'react';

import type { PermissionStatus } from './permissions';

import {
  IconAlertTriangle,
  IconCircleCheck,
  IconDeviceDesktop,
  IconRefresh,
  IconVolume
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { COPILOT_SURFACE } from './copilot-styles';
import { AudioPreview, LevelMeter } from './device-check-ui';
import ScreenRecordingHelp from './screen-recording-help';
import { useSystemAudioTest } from './use-system-audio-test';

const SURFACE = COPILOT_SURFACE;

function statusLabel(status: PermissionStatus): string {
  switch (status) {
    case 'granted': {
      return 'Granted';
    }
    case 'denied': {
      return 'Denied';
    }
    case 'not-determined': {
      return 'Not asked yet';
    }
    case 'restricted': {
      return 'Restricted';
    }
    case 'unsupported': {
      return 'Supported (no extra prompt)';
    }
    default: {
      return 'Unknown';
    }
  }
}

function VerdictBanner({
  verdict,
  error,
  phase
}: {
  verdict: ReturnType<typeof useSystemAudioTest>['verdict'];
  error: string | null;
  phase: ReturnType<typeof useSystemAudioTest>['phase'];
}) {
  if (phase === 'finalizing') {
    return <p className='text-muted-foreground text-sm'>Saving capture and preparing preview…</p>;
  }

  if (verdict === 'idle' && phase !== 'preview') {
    return (
      <p className='text-muted-foreground text-sm'>
        Capture audio from meetings and other apps on your computer. Watch the level meter while the
        test runs, then end the test to play back your recording.
      </p>
    );
  }

  if (verdict === 'no-permission') {
    return (
      <div className='flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200'>
        <IconAlertTriangle className='mt-0.5 size-4 shrink-0' />
        <span>
          System audio requires System Audio Recording permission on macOS. Enable it in System
          Settings, then run the test again.
        </span>
      </div>
    );
  }

  if (verdict === 'waiting-for-sound') {
    return (
      <div className='border-border bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-xl border px-4 py-3 text-sm'>
        <IconVolume className='mt-0.5 size-4 shrink-0 animate-pulse' />
        <span>
          Capturing system audio… play meeting or app audio on your computer. Levels should move
          when sound is detected.
        </span>
      </div>
    );
  }

  if (verdict === 'working') {
    return (
      <div className='flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300'>
        <IconCircleCheck className='mt-0.5 size-4 shrink-0' />
        <span>
          System audio is being captured. End the test when ready to review your recording.
        </span>
      </div>
    );
  }

  if (verdict === 'recorded' || phase === 'preview') {
    return (
      <div className='flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300'>
        <IconCircleCheck className='mt-0.5 size-4 shrink-0' />
        <span>
          Test complete. Listen to the preview below to confirm system audio was recorded.
        </span>
      </div>
    );
  }

  return (
    <div className='border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl border px-4 py-3 text-sm'>
      <IconAlertTriangle className='mt-0.5 size-4 shrink-0' />
      <span>{error ?? 'System audio test failed.'}</span>
    </div>
  );
}

export default function SystemAudioTestScreen({ isDesktop }: { isDesktop: boolean }) {
  const {
    phase,
    verdict,
    error,
    permission,
    level,
    peakLevel,
    captureLabel,
    previewUrl,
    previewDurationSec,
    refreshPermission,
    startMonitoring,
    endTestAndPreview,
    discardPreview,
    openSystemAudioSettings,
    registerScreenRecordingAccess,
    soundThreshold
  } = useSystemAudioTest(isDesktop);

  const isMonitoring = phase === 'monitoring';
  const isBusy = phase === 'requesting' || phase === 'finalizing';
  const showPreview = Boolean(previewUrl) && (phase === 'preview' || verdict === 'recorded');

  const permissionBadgeVariant = useMemo(() => {
    if (permission.granted || permission.status === 'unsupported') {
      return 'default';
    }
    if (permission.status === 'denied' || permission.status === 'restricted') {
      return 'destructive';
    }
    return 'secondary';
  }, [permission]);

  return (
    <div className='space-y-6'>
      <Card className={SURFACE}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <IconDeviceDesktop className='text-primary size-5' />
            System audio permission
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <Badge variant={permissionBadgeVariant}>{statusLabel(permission.status)}</Badge>
            <span className='text-muted-foreground text-sm'>
              {isDesktop
                ? permission.granted
                  ? 'System Audio Recording is enabled for system audio capture.'
                  : 'Enable System Audio Recording for this app in macOS System Settings (see steps below).'
                : 'Use the desktop app for full system audio capture.'}
            </span>
            <Button
              variant='outline'
              size='sm'
              className='ml-auto rounded-full'
              onClick={() => {
                void refreshPermission();
              }}
            >
              <IconRefresh className='mr-1.5 size-3.5' />
              Refresh
            </Button>
          </div>
          {isDesktop && !permission.granted && permission.status !== 'unsupported' ? (
            <ScreenRecordingHelp
              isDesktop={isDesktop}
              isRequesting={phase === 'requesting'}
              onOpenSettings={() => {
                void openSystemAudioSettings();
              }}
              onRequestAccess={() => {
                void registerScreenRecordingAccess();
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card className={SURFACE}>
        <CardHeader>
          <CardTitle className='text-base'>System audio test</CardTitle>
        </CardHeader>
        <CardContent className='space-y-5'>
          <VerdictBanner verdict={verdict} error={error} phase={phase} />

          {showPreview && previewUrl ? (
            <AudioPreview
              url={previewUrl}
              durationSec={previewDurationSec}
              title='System audio preview'
              description='Press play to confirm meeting or app audio was recorded clearly.'
            />
          ) : null}

          {!showPreview && !isDesktop ? (
            <p className='border-border/70 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-3 text-sm'>
              On web, you will pick a screen or tab to share when the test starts. For reliable
              meeting audio capture, use the desktop app.
            </p>
          ) : null}

          {isMonitoring ? (
            <LevelMeter level={level} peakLevel={peakLevel} />
          ) : showPreview ? null : (
            <div className='border-border/70 bg-muted/20 text-muted-foreground flex h-28 items-center justify-center rounded-xl border border-dashed text-sm'>
              Level meter appears when capture is running
            </div>
          )}

          {captureLabel && isMonitoring ? (
            <p className='text-muted-foreground text-xs'>Capturing: {captureLabel}</p>
          ) : null}

          {showPreview ? null : (
            <p className='text-muted-foreground text-xs'>
              Sound is detected when live level exceeds {(soundThreshold * 100).toFixed(0)}%. The
              session is recorded; end the test to preview what was captured.
            </p>
          )}

          <div className='flex flex-wrap gap-2'>
            {showPreview ? (
              <>
                <Button
                  className='rounded-full bg-gradient-to-r from-[#1E3A8A] via-[#3B82F6] to-[#06B6D4] text-white'
                  onClick={() => {
                    discardPreview();
                    void startMonitoring();
                  }}
                >
                  <IconDeviceDesktop className='mr-1.5 size-4' />
                  Run another test
                </Button>
                <Button variant='outline' className='rounded-full' onClick={discardPreview}>
                  Dismiss preview
                </Button>
              </>
            ) : isMonitoring ? (
              <Button
                className='rounded-full bg-gradient-to-r from-[#1E3A8A] via-[#3B82F6] to-[#06B6D4] text-white'
                onClick={() => {
                  void endTestAndPreview();
                }}
              >
                End test & preview
              </Button>
            ) : (
              <Button
                className='rounded-full bg-gradient-to-r from-[#1E3A8A] via-[#3B82F6] to-[#06B6D4] text-white'
                disabled={isBusy}
                onClick={() => {
                  void startMonitoring();
                }}
              >
                <IconDeviceDesktop className='mr-1.5 size-4' />
                {phase === 'requesting' ? 'Starting…' : 'Start system audio test'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
