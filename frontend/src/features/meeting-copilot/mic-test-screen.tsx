import { useMemo } from 'react';

import {
  IconAlertTriangle,
  IconCircleCheck,
  IconMicrophone,
  IconRefresh,
  IconVolume,
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { COPILOT_SURFACE } from './copilot-styles';
import { AudioPreview, LevelMeter } from './device-check-ui';
import { openDesktopPermissionSettings, type PermissionStatus } from './permissions';
import { useMicrophoneTest } from './use-microphone-test';

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
      return 'Unsupported';
    default:
      return 'Unknown';
  }
}

function VerdictBanner({
  verdict,
  error,
  phase,
}: {
  verdict: ReturnType<typeof useMicrophoneTest>['verdict'];
  error: string | null;
  phase: ReturnType<typeof useMicrophoneTest>['phase'];
}) {
  if (phase === 'finalizing') {
    return (
      <p className='text-sm text-muted-foreground'>Saving your recording and preparing preview…</p>
    );
  }

  if (verdict === 'idle' && phase !== 'preview') {
    return (
      <p className='text-sm text-muted-foreground'>
        Verify your microphone before joining a meeting. Your voice is recorded during the test;
        end the test to listen to a preview.
      </p>
    );
  }

  if (verdict === 'no-permission') {
    return (
      <div className='flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200'>
        <IconAlertTriangle className='mt-0.5 size-4 shrink-0' />
        <span>Microphone permission is not granted. Enable it in Settings → Permissions first.</span>
      </div>
    );
  }

  if (verdict === 'waiting-for-sound') {
    return (
      <div className='flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground'>
        <IconVolume className='mt-0.5 size-4 shrink-0 animate-pulse' />
        <span>Listening… speak into your microphone. End the test when finished to hear a preview.</span>
      </div>
    );
  }

  if (verdict === 'working') {
    return (
      <div className='flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300'>
        <IconCircleCheck className='mt-0.5 size-4 shrink-0' />
        <span>Microphone is working — audio is being recorded. End the test to listen to your preview.</span>
      </div>
    );
  }

  if (verdict === 'recorded' || phase === 'preview') {
    return (
      <div className='flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300'>
        <IconCircleCheck className='mt-0.5 size-4 shrink-0' />
        <span>Test complete. Use the audio preview below to listen to your recording.</span>
      </div>
    );
  }

  return (
    <div className='flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
      <IconAlertTriangle className='mt-0.5 size-4 shrink-0' />
      <span>{error ?? 'Microphone test failed.'}</span>
    </div>
  );
}

export default function MicTestScreen({
  isDesktop,
  embedded = false,
}: {
  isDesktop: boolean;
  embedded?: boolean;
}) {
  const {
    phase,
    verdict,
    error,
    permission,
    level,
    peakLevel,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    activeDeviceLabel,
    previewUrl,
    previewDurationSec,
    refreshPermission,
    startMonitoring,
    endTestAndPreview,
    discardPreview,
    switchDevice,
    soundThreshold,
  } = useMicrophoneTest();

  const isMonitoring = phase === 'monitoring';
  const isBusy = phase === 'requesting' || phase === 'finalizing';
  const showPreview = Boolean(previewUrl) && (phase === 'preview' || verdict === 'recorded');

  const permissionBadgeVariant = useMemo(() => {
    if (permission.granted) return 'default';
    if (permission.status === 'denied' || permission.status === 'restricted') {
      return 'destructive';
    }
    return 'secondary';
  }, [permission]);

  const content = (
    <div className={cn('space-y-6', !embedded && 'mx-auto max-w-3xl')}>
      <Card className={SURFACE}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <IconMicrophone className='size-5 text-primary' />
            Permission status
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <Badge variant={permissionBadgeVariant}>{statusLabel(permission.status)}</Badge>
            <span className='text-sm text-muted-foreground'>
              {permission.granted
                ? 'OS reports microphone access is allowed.'
                : 'Microphone access is required before testing.'}
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
          {!permission.granted && isDesktop ? (
            <Button
              variant='outline'
              size='sm'
              className='rounded-full'
              onClick={() => {
                void openDesktopPermissionSettings('microphone');
              }}
            >
              Open microphone settings
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className={SURFACE}>
        <CardHeader>
          <CardTitle className='text-base'>Microphone test</CardTitle>
        </CardHeader>
        <CardContent className='space-y-5'>
          <VerdictBanner verdict={verdict} error={error} phase={phase} />

          {showPreview && previewUrl ? (
            <AudioPreview
              url={previewUrl}
              durationSec={previewDurationSec}
              autoPlay
              title='Microphone preview'
              description='Listen to confirm your voice was captured clearly before joining a meeting.'
            />
          ) : null}

          {devices.length > 0 && !showPreview ? (
            <div className='space-y-2'>
              <label htmlFor='mic-device' className='text-sm font-medium text-foreground'>
                Input device
              </label>
              <select
                id='mic-device'
                className='w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground'
                value={selectedDeviceId}
                disabled={isBusy}
                onChange={(event) => {
                  const deviceId = event.target.value;
                  if (isMonitoring) {
                    void switchDevice(deviceId);
                  } else {
                    setSelectedDeviceId(deviceId);
                  }
                }}
              >
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
              {activeDeviceLabel ? (
                <p className='text-xs text-muted-foreground'>Active: {activeDeviceLabel}</p>
              ) : null}
            </div>
          ) : null}

          {isMonitoring ? (
            <LevelMeter level={level} peakLevel={peakLevel} />
          ) : !showPreview ? (
            <div className='flex h-28 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground'>
              Level meter appears when the test is running
            </div>
          ) : null}

          {!showPreview ? (
            <p className='text-xs text-muted-foreground'>
              Audio is detected when live level exceeds {(soundThreshold * 100).toFixed(0)}%. The
              full test session is recorded and available as a preview when you end the test.
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
                  <IconMicrophone className='mr-1.5 size-4' />
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
                <IconMicrophone className='mr-1.5 size-4' />
                {phase === 'requesting' ? 'Starting…' : 'Start microphone test'}
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

  return content;
}
