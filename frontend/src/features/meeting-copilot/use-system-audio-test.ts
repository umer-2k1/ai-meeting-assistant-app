import { useCallback, useEffect, useRef, useState } from 'react';

import type { PermissionSnapshot } from './permissions';

import { fetchSystemAudioPermissionStatus, openDesktopPermissionSettings } from './permissions';

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
      return 'System audio capture was denied. Enable System Audio Recording in System Settings for this app.';
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
  for (const element of buffer) {
    const normalized = (element - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / buffer.length);
}

async function acquireViaDisplayMedia(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('System audio capture is not supported in this browser.');
  }

  // System Audio Recording Only (CoreAudio Tap): request audio without video.
  // The main-process handler returns { audio: 'loopback' }, so no screen capture occurs.
  const raw = await navigator.mediaDevices.getDisplayMedia({
    video: false,
    audio: true
  });

  const audioTracks = raw.getAudioTracks();
  const videoTracks = raw.getVideoTracks();
  for (const track of videoTracks) {
    track.stop();
  }

  const audioTrack = audioTracks[0];
  if (!audioTrack || audioTrack.readyState === 'ended') {
    for (const track of audioTracks) {
      track.stop();
    }
    throw new Error(
      'System Audio Recording Only is not enabled for this app. Enable it in System Settings → Privacy & Security → Screen & System Audio Recording → System Audio Recording Only, then quit (Cmd+Q) and restart the app.'
    );
  }

  return new MediaStream(audioTracks);
}

export function useSystemAudioTest(isDesktop: boolean) {
  const [phase, setPhase] = useState<SystemAudioTestPhase>('idle');
  const [verdict, setVerdict] = useState<SystemAudioTestVerdict>('idle');
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionSnapshot>({
    status: 'unknown',
    granted: false
  });
  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [captureLabel, setCaptureLabel] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDurationSec, setPreviewDurationSec] = useState<number | null>(null);

  const streamReference = useRef<MediaStream | null>(null);
  const audioContextReference = useRef<AudioContext | null>(null);
  const analyserReference = useRef<AnalyserNode | null>(null);
  const levelBufferReference = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const levelTimerReference = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRecorderReference = useRef<MediaRecorder | null>(null);
  const sessionChunksReference = useRef<Blob[]>([]);
  const previewUrlReference = useRef<string | null>(null);

  const refreshPermission = useCallback(async () => {
    const snapshot = await fetchSystemAudioPermissionStatus(isDesktop);
    setPermission(snapshot);
    return snapshot;
  }, [isDesktop]);

  const loadSources = useCallback(async () => {
    // System Audio Recording Only does not use a screen/window source list.
    setSources([]);
  }, []);

  const stopLevelPolling = useCallback(() => {
    if (levelTimerReference.current !== null) {
      clearInterval(levelTimerReference.current);
      levelTimerReference.current = null;
    }
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlReference.current) {
      URL.revokeObjectURL(previewUrlReference.current);
      previewUrlReference.current = null;
    }
    setPreviewUrl(null);
    setPreviewDurationSec(null);
  }, []);

  const releaseCapture = useCallback(() => {
    stopLevelPolling();

    if (sessionRecorderReference.current?.state !== 'inactive') {
      try {
        sessionRecorderReference.current?.stop();
      } catch {
        // ignore
      }
    }
    sessionRecorderReference.current = null;
    sessionChunksReference.current = [];

    if (streamReference.current) {
      for (const track of streamReference.current.getTracks()) {
        track.stop();
      }
      streamReference.current = null;
    }

    if (audioContextReference.current) {
      void audioContextReference.current.close();
      audioContextReference.current = null;
    }

    analyserReference.current = null;
    levelBufferReference.current = null;
    setLevel(0);
  }, [stopLevelPolling]);

  const startLevelPolling = useCallback(() => {
    stopLevelPolling();

    levelTimerReference.current = setInterval(() => {
      const analyser = analyserReference.current;
      const buffer = levelBufferReference.current;
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
    sessionChunksReference.current = [];
    const mimeType = pickRecorderMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        sessionChunksReference.current.push(event.data);
      }
    };

    sessionRecorderReference.current = recorder;
    recorder.start(RECORDER_TIMESLICE_MS);
  }, []);

  const finalizeSessionRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = sessionRecorderReference.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(
          sessionChunksReference.current.length > 0
            ? new Blob(sessionChunksReference.current, { type: 'audio/webm' })
            : null
        );
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(sessionChunksReference.current, {
          type: recorder.mimeType || 'audio/webm'
        });
        sessionRecorderReference.current = null;
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
      previewUrlReference.current = url;
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

  const setupAnalyser = useCallback(
    async (stream: MediaStream) => {
      streamReference.current = stream;

      const label = stream.getAudioTracks()[0]?.label;
      setCaptureLabel(label || null);

      const audioContext = new AudioContext();
      await audioContext.resume();
      audioContextReference.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      analyserReference.current = analyser;
      levelBufferReference.current = new Uint8Array(analyser.fftSize);

      startSessionRecorder(stream);
    },
    [startSessionRecorder]
  );

  const acquireSystemAudio = useCallback(async () => {
    // System Audio Recording Only uses getDisplayMedia loopback on all platforms.
    // Legacy chromeMediaSource getUserMedia does not provide macOS system-audio loopback.
    return acquireViaDisplayMedia();
  }, []);

  const startMonitoring = useCallback(async () => {
    setError(null);
    setPeakLevel(0);
    setLevel(0);
    clearPreview();
    setVerdict('idle');
    setPhase('requesting');

    try {
      releaseCapture();

      const stream = await acquireSystemAudio();
      // A successful loopback capture means System Audio Recording Only is granted.
      setPermission({ status: 'granted', granted: true, canRequest: false });
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
  }, [acquireSystemAudio, clearPreview, releaseCapture, setupAnalyser, startLevelPolling]);

  const endTestAndPreview = useCallback(async () => {
    if (phase !== 'monitoring') {
      return;
    }

    setPhase('finalizing');
    setError(null);
    stopLevelPolling();

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
  }, [finalizeSessionRecording, phase, releaseCapture, setPreviewFromBlob, stopLevelPolling]);

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

  /** Triggers macOS TCC so the app appears under System Audio Recording in System Settings. */
  const registerScreenRecordingAccess = useCallback(async () => {
    setPhase('requesting');
    setError(null);

    try {
      await loadSources();

      // Always use getDisplayMedia on desktop so macOS loopback audio can be captured.
      if (typeof navigator.mediaDevices?.getDisplayMedia === 'function') {
        try {
          const stream = await acquireViaDisplayMedia();
          for (const track of stream.getTracks()) {
            track.stop();
          }
        } catch {
          // Denied or cancelled — app should still appear in System Audio Recording list
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
  }, [loadSources, refreshPermission]);

  useEffect(() => {
    void refreshPermission();
    void loadSources();
  }, [loadSources, refreshPermission]);

  useEffect(() => {
    return () => {
      releaseCapture();
      if (previewUrlReference.current) {
        URL.revokeObjectURL(previewUrlReference.current);
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
    isDesktop,
    refreshPermission,
    startMonitoring,
    endTestAndPreview,
    discardPreview,
    openSystemAudioSettings,
    registerScreenRecordingAccess,
    soundThreshold: SOUND_LEVEL_THRESHOLD
  };
}
