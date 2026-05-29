import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchSystemAudioPermissionStatus,
  openDesktopPermissionSettings,
  type PermissionSnapshot,
} from './permissions';

const LEVEL_POLL_MS = 50;
const SOUND_LEVEL_THRESHOLD = 0.04;
const RECORDER_TIMESLICE_MS = 500;

export type SystemAudioTestPhase =
  | 'idle'
  | 'requesting'
  | 'monitoring'
  | 'finalizing'
  | 'preview'
  | 'error';

export type SystemAudioTestVerdict =
  | 'idle'
  | 'no-permission'
  | 'waiting-for-sound'
  | 'working'
  | 'recorded'
  | 'error';

export type CaptureSource = {
  id: string;
  name: string;
  displayId?: string;
};

function getMediaErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'System audio capture was denied. Enable Screen Recording in System Settings for this app.';
    }
    if (error.name === 'NotFoundError') {
      return 'No capture source was found. Try another screen or window.';
    }
    if (error.name === 'NotReadableError') {
      return 'Could not capture system audio. Another app may be blocking access.';
    }
    return error.message || error.name;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not capture system audio.';
}

function pickRecorderMimeType(): string {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }
  return '';
}

function computeRmsLevel(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const normalized = (buffer[i]! - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / buffer.length);
}

function audioOnlyStream(stream: MediaStream): MediaStream {
  const audioTracks = stream.getAudioTracks();
  for (const track of stream.getVideoTracks()) {
    track.stop();
  }
  if (audioTracks.length === 0) {
    throw new Error(
      'No system audio track was captured. On macOS, enable Screen Recording for this app, then share a screen or window that includes audio.'
    );
  }
  return new MediaStream(audioTracks);
}

async function acquireViaDesktopSource(sourceId: string): Promise<MediaStream> {
  const constraints = {
    audio: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
      },
    },
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
      },
    },
  } as MediaStreamConstraints;

  const raw = await navigator.mediaDevices.getUserMedia(constraints);
  return audioOnlyStream(raw);
}

async function acquireViaDisplayMedia(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('System audio capture is not supported in this browser.');
  }

  const raw = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });
  return audioOnlyStream(raw);
}

export function useSystemAudioTest(isDesktop: boolean) {
  const [phase, setPhase] = useState<SystemAudioTestPhase>('idle');
  const [verdict, setVerdict] = useState<SystemAudioTestVerdict>('idle');
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionSnapshot>({
    status: 'unknown',
    granted: false,
  });
  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [captureLabel, setCaptureLabel] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDurationSec, setPreviewDurationSec] = useState<number | null>(null);
  const [monitorStream, setMonitorStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionChunksRef = useRef<Blob[]>([]);
  const previewUrlRef = useRef<string | null>(null);

  const refreshPermission = useCallback(async () => {
    const snapshot = await fetchSystemAudioPermissionStatus(isDesktop);
    setPermission(snapshot);
    return snapshot;
  }, [isDesktop]);

  const loadSources = useCallback(async () => {
    if (!isDesktop || !globalThis.window.desktop?.deviceCheck?.listCaptureSources) {
      setSources([]);
      return;
    }

    try {
      const listed = await globalThis.window.desktop.deviceCheck.listCaptureSources();
      setSources(listed);
      if (listed.length > 0 && !listed.some((s) => s.id === selectedSourceId)) {
        const screen = listed.find((s) => s.name.toLowerCase().includes('screen')) ?? listed[0]!;
        setSelectedSourceId(screen.id);
      }
    } catch {
      setSources([]);
    }
  }, [isDesktop, selectedSourceId]);

  const stopLevelPolling = useCallback(() => {
    if (levelTimerRef.current !== null) {
      clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPreviewDurationSec(null);
  }, []);

  const releaseCapture = useCallback(() => {
    stopLevelPolling();

    if (sessionRecorderRef.current?.state !== 'inactive') {
      try {
        sessionRecorderRef.current?.stop();
      } catch {
        // ignore
      }
    }
    sessionRecorderRef.current = null;
    sessionChunksRef.current = [];

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    setMonitorStream(null);

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    levelBufferRef.current = null;
    setLevel(0);
  }, [stopLevelPolling]);

  const startLevelPolling = useCallback(() => {
    stopLevelPolling();

    levelTimerRef.current = setInterval(() => {
      const analyser = analyserRef.current;
      const buffer = levelBufferRef.current;
      if (!analyser || !buffer) {
        return;
      }

      const rms = computeRmsLevel(analyser, buffer);
      setLevel(rms);
      setPeakLevel((current) => Math.max(current, rms));

      if (rms >= SOUND_LEVEL_THRESHOLD) {
        setVerdict((current) =>
          current === 'waiting-for-sound' || current === 'idle' ? 'working' : current
        );
      }
    }, LEVEL_POLL_MS);
  }, [stopLevelPolling]);

  const startSessionRecorder = useCallback((stream: MediaStream) => {
    sessionChunksRef.current = [];
    const mimeType = pickRecorderMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        sessionChunksRef.current.push(event.data);
      }
    };

    sessionRecorderRef.current = recorder;
    recorder.start(RECORDER_TIMESLICE_MS);
  }, []);

  const finalizeSessionRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = sessionRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(
          sessionChunksRef.current.length > 0
            ? new Blob(sessionChunksRef.current, { type: 'audio/webm' })
            : null
        );
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(sessionChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        sessionRecorderRef.current = null;
        resolve(blob.size > 0 ? blob : null);
      };

      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  const setPreviewFromBlob = useCallback(
    (blob: Blob) => {
      clearPreview();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setVerdict('recorded');
      setPhase('preview');

      const audio = new Audio(url);
      audio.addEventListener(
        'loadedmetadata',
        () => {
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setPreviewDurationSec(audio.duration);
          }
        },
        { once: true }
      );
    },
    [clearPreview]
  );

  const setupAnalyser = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;
    setMonitorStream(stream);

    const label = stream.getAudioTracks()[0]?.label;
    setCaptureLabel(label || null);

    const audioContext = new AudioContext();
    await audioContext.resume();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.65;
    source.connect(analyser);
    analyserRef.current = analyser;
    levelBufferRef.current = new Uint8Array(analyser.fftSize);

    startSessionRecorder(stream);
  }, [startSessionRecorder]);

  const acquireSystemAudio = useCallback(async () => {
    if (isDesktop && selectedSourceId && globalThis.window.desktop?.deviceCheck) {
      return acquireViaDesktopSource(selectedSourceId);
    }
    return acquireViaDisplayMedia();
  }, [isDesktop, selectedSourceId]);

  const startMonitoring = useCallback(async () => {
    setError(null);
    setPeakLevel(0);
    setLevel(0);
    clearPreview();
    setVerdict('idle');
    setPhase('requesting');

    try {
      await refreshPermission();

      await loadSources();
      releaseCapture();

      const stream = await acquireSystemAudio();
      await setupAnalyser(stream);
      startLevelPolling();
      setVerdict('waiting-for-sound');
      setPhase('monitoring');
    } catch (captureError) {
      setError(getMediaErrorMessage(captureError));
      setVerdict('error');
      setPhase('error');
      releaseCapture();
    }
  }, [
    acquireSystemAudio,
    clearPreview,
    isDesktop,
    loadSources,
    refreshPermission,
    releaseCapture,
    setupAnalyser,
    startLevelPolling,
  ]);

  const endTestAndPreview = useCallback(async () => {
    if (phase !== 'monitoring') {
      return;
    }

    setPhase('finalizing');
    setError(null);
    stopLevelPolling();
    setMonitorStream(null);

    const blob = await finalizeSessionRecording();
    releaseCapture();

    if (!blob || blob.size === 0) {
      setError(
        'No system audio was captured. Play music or meeting audio on your computer during the test, then try again.'
      );
      setVerdict('error');
      setPhase('idle');
      return;
    }

    setPreviewFromBlob(blob);
  }, [
    finalizeSessionRecording,
    phase,
    releaseCapture,
    setPreviewFromBlob,
    stopLevelPolling,
  ]);

  const discardPreview = useCallback(() => {
    clearPreview();
    setPeakLevel(0);
    setVerdict('idle');
    setPhase('idle');
    setError(null);
  }, [clearPreview]);

  const openSystemAudioSettings = useCallback(async () => {
    await openDesktopPermissionSettings('systemAudio');
    await refreshPermission();
  }, [refreshPermission]);

  /** Triggers macOS TCC so the app appears under Screen Recording in System Settings. */
  const registerScreenRecordingAccess = useCallback(async () => {
    setPhase('requesting');
    setError(null);

    try {
      await loadSources();

      if (isDesktop && selectedSourceId && globalThis.window.desktop?.deviceCheck) {
        try {
          const stream = await acquireViaDesktopSource(selectedSourceId);
          for (const track of stream.getTracks()) {
            track.stop();
          }
        } catch {
          // Denied or cancelled — app should still appear in Screen Recording list
        }
      } else if (typeof navigator.mediaDevices?.getDisplayMedia === 'function') {
        try {
          const stream = await acquireViaDisplayMedia();
          for (const track of stream.getTracks()) {
            track.stop();
          }
        } catch {
          // User cancelled picker or denied
        }
      }

      const snapshot = await refreshPermission();
      if (snapshot.granted) {
        setVerdict('idle');
        setPhase('idle');
        return;
      }

      setVerdict('no-permission');
      setPhase('idle');
    } catch (registerError) {
      setError(getMediaErrorMessage(registerError));
      setVerdict('error');
      setPhase('error');
    }
  }, [isDesktop, loadSources, refreshPermission, selectedSourceId]);

  useEffect(() => {
    void refreshPermission();
    void loadSources();
  }, [loadSources, refreshPermission]);

  useEffect(() => {
    return () => {
      releaseCapture();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [releaseCapture]);

  return {
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
    isDesktop,
    refreshPermission,
    startMonitoring,
    endTestAndPreview,
    discardPreview,
    openSystemAudioSettings,
    registerScreenRecordingAccess,
    soundThreshold: SOUND_LEVEL_THRESHOLD,
  };
}
