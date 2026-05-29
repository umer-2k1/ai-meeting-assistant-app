import { useMemo } from 'react';

import {
  IconAlertTriangle,
  IconCircleCheck,
  IconDeviceDesktop,
  IconRefresh,
  IconVolume,
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { COPILOT_SURFACE } from './copilot-styles';
import { AudioPreview, LevelMeter, LiveAudioMonitor } from './device-check-ui';
import type { PermissionStatus } from './permissions';
import { useSystemAudioTest } from './use-system-audio-test';

const SURFACE = COPILOT_SURFACE;

function statusLabel(status: PermissionStatus): string {
  switch (status) {
    case 'granted':
      return 'Granted';
    case 'denied':
      return 'Denied';
    case 'not-determined':
      return 'Not asked yet';
    case 'restricted':
      return 'Restricted';
    case 'unsupported':
      return 'Supported (no extra prompt)';
    default:
      return 'Unknown';
  }
}

function VerdictBanner({
  verdict,
  error,
  phase,
}: {
  verdict: ReturnType<typeof useSystemAudioTest>['verdict'];
  error: string | null;
  phase: ReturnType<typeof useSystemAudioTest>['phase'];
}) {
  if (phase === 'finalizing') {
    return (
      <p className='text-sm text-muted-foreground'>Saving capture and preparing preview…</p>
    );
  }

  if (verdict === 'idle' && phase !== 'preview') {
    return (
      <p className='text-sm text-muted-foreground'>
        Capture audio from meetings and other apps on your computer. Use the live monitor while the
        test runs, then end the test to hear a recording preview.
      </p>
    );
  }

  if (verdict === 'no-permission') {
    return (
      <div className='flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200'>
        <IconAlertTriangle className='mt-0.5 size-4 shrink-0' />
        <span>
          System audio requires Screen Recording on macOS. Enable it in System Settings, then run
          the test again.
        </span>
      </div>
    );
  }

  if (verdict === 'waiting-for-sound') {
    return (
      <div className='flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground'>
        <IconVolume className='mt-0.5 size-4 shrink-0 animate-pulse' />
        <span>
          Capturing system audio… play meeting or app audio on your computer. Levels should move when
          sound is detected.
        </span>
      </div>
    );
  }

  if (verdict === 'working') {
    return (
      <div className='flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300'>
        <IconCircleCheck className='mt-0.5 size-4 shrink-0' />
        <span>System audio is being captured. End the test when ready to review your recording.</span>
      </div>
    );
  }

  if (verdict === 'recorded' || phase === 'preview') {
    return (
      <div className='flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300'>
        <IconCircleCheck className='mt-0.5 size-4 shrink-0' />
        <span>Test complete. Listen to the preview below to confirm system audio was recorded.</span>
      </div>
    );
  }

  return (
    <div className='flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
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
    sources,
    selectedSourceId,
    setSelectedSourceId,
    captureLabel,
    previewUrl,
    previewDurationSec,
    monitorStream,
    refreshPermission,
    startMonitoring,
    endTestAndPreview,
    discardPreview,
    openSystemAudioSettings,
    soundThreshold,
  } = useSystemAudioTest(isDesktop);

  const isMonitoring = phase === 'monitoring';
  const isBusy = phase === 'requesting' || phase === 'finalizing';
  const showPreview = Boolean(previewUrl) && (phase === 'preview' || verdict === 'recorded');

  const permissionBadgeVariant = useMemo(() => {
    if (permission.granted || permission.status === 'unsupported') return 'default';
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
            <IconDeviceDesktop className='size-5 text-primary' />
            System audio permission
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <Badge variant={permissionBadgeVariant}>{statusLabel(permission.status)}</Badge>
            <span className='text-sm text-muted-foreground'>
              {isDesktop
                ? permission.granted
                  ? 'Screen Recording is enabled for system audio capture.'
                  : 'On macOS, enable Screen Recording for this app (may appear as Electron in dev).'
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
            <Button
              variant='outline'
              size='sm'
              className='rounded-full'
              onClick={() => {
                void openSystemAudioSettings();
              }}
            >
              Open Screen Recording settings
            </Button>
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
              autoPlay
              title='System audio preview'
              description='This recording captured audio from your screen or shared source. Confirm meeting or app audio is audible.'
            />
          ) : null}

          {isMonitoring && monitorStream ? (
            <LiveAudioMonitor stream={monitorStream} label='Live system audio monitor' />
          ) : null}

          {!showPreview && isDesktop && sources.length > 0 ? (
            <div className='space-y-2'>
              <label htmlFor='capture-source' className='text-sm font-medium text-foreground'>
                Capture source
              </label>
              <select
                id='capture-source'
                className='w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground'
                value={selectedSourceId}
                disabled={isBusy || isMonitoring}
                onChange={(event) => {
                  setSelectedSourceId(event.target.value);
                }}
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
              <p className='text-xs text-muted-foreground'>
                Choose a screen or window to capture. Play audio on that display during the test.
              </p>
            </div>
          ) : null}

          {!showPreview && !isDesktop ? (
            <p className='rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground'>
              On web, you will pick a screen or tab to share when the test starts. For reliable
              meeting audio capture, use the desktop app.
            </p>
          ) : null}

          {isMonitoring ? (
            <LevelMeter level={level} peakLevel={peakLevel} />
          ) : !showPreview ? (
            <div className='flex h-28 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground'>
              Level meter appears when capture is running
            </div>
          ) : null}

          {captureLabel && isMonitoring ? (
            <p className='text-xs text-muted-foreground'>Capturing: {captureLabel}</p>
          ) : null}

          {!showPreview ? (
            <p className='text-xs text-muted-foreground'>
              Sound is detected when live level exceeds {(soundThreshold * 100).toFixed(0)}%. The
              session is recorded; end the test to preview what was captured.
            </p>
          ) : null}

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
            ) : !isMonitoring ? (
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
            ) : (
              <Button
                className='rounded-full bg-gradient-to-r from-[#1E3A8A] via-[#3B82F6] to-[#06B6D4] text-white'
                onClick={() => {
                  void endTestAndPreview();
                }}
              >
                End test & preview
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
