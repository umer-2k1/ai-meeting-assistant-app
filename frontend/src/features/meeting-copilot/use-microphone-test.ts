import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchMicrophonePermissionStatus,
  requestMicrophoneAccess,
  type PermissionSnapshot,
} from './permissions';

const LEVEL_POLL_MS = 50;
const SOUND_LEVEL_THRESHOLD = 0.06;
const RECORDER_TIMESLICE_MS = 500;

export type MicTestPhase =
  | 'idle'
  | 'requesting'
  | 'monitoring'
  | 'finalizing'
  | 'preview'
  | 'error';

export type MicTestVerdict =
  | 'idle'
  | 'no-permission'
  | 'waiting-for-sound'
  | 'working'
  | 'recorded'
  | 'error';

export type MicInputDevice = {
  deviceId: string;
  label: string;
};

function getMediaErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Microphone access was denied. Enable it in Settings → Permissions or your system privacy settings.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No microphone was found. Connect a microphone and try again.';
    }
    if (error.name === 'NotReadableError') {
      return 'Microphone is in use by another app or could not be opened.';
    }
    return error.message || error.name;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not access the microphone.';
}

function pickRecorderMimeType(): string {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'audio/mp4';
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

function revokePreviewUrl(urlRef: { current: string | null }) {
  if (urlRef.current) {
    URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }
}

export function useMicrophoneTest() {
  const [phase, setPhase] = useState<MicTestPhase>('idle');
  const [verdict, setVerdict] = useState<MicTestVerdict>('idle');
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionSnapshot>({
    status: 'unknown',
    granted: false,
  });
  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [devices, setDevices] = useState<MicInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [activeDeviceLabel, setActiveDeviceLabel] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDurationSec, setPreviewDurationSec] = useState<number | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionChunksRef = useRef<Blob[]>([]);
  const previewUrlRef = useRef<string | null>(null);

  const refreshPermission = useCallback(async () => {
    const snapshot = await fetchMicrophonePermissionStatus();
    setPermission(snapshot);
    return snapshot;
  }, []);

  const stopLevelPolling = useCallback(() => {
    if (levelTimerRef.current !== null) {
      clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
  }, []);

  const clearPreview = useCallback(() => {
    revokePreviewUrl(previewUrlRef);
    setPreviewUrl(null);
    setPreviewDurationSec(null);
  }, []);

  const releaseCapture = useCallback(() => {
    stopLevelPolling();

    if (sessionRecorderRef.current && sessionRecorderRef.current.state !== 'inactive') {
      try {
        sessionRecorderRef.current.stop();
      } catch {
        // already stopped
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

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    levelBufferRef.current = null;
    setLevel(0);
  }, [stopLevelPolling]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      return;
    }

    const all = await navigator.mediaDevices.enumerateDevices();
    const inputs = all
      .filter((device) => device.kind === 'audioinput')
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8) || 'default'}`,
      }));

    setDevices(inputs);

    if (inputs.length > 0 && !inputs.some((d) => d.deviceId === selectedDeviceId)) {
      setSelectedDeviceId(inputs[0]!.deviceId);
    }
  }, [selectedDeviceId]);

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

    recorder.onerror = () => {
      setError('Recording failed during the test.');
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

  const setPreviewFromBlob = useCallback((blob: Blob) => {
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
  }, [clearPreview]);

  const acquireStream = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone capture is not supported in this environment.');
      }

      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const audioTrack = stream.getAudioTracks()[0];
      setActiveDeviceLabel(audioTrack?.label || null);

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
      await refreshDevices();
      return stream;
    },
    [refreshDevices, startSessionRecorder]
  );

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
      setError('No audio was captured. Speak into your microphone during the test and try again.');
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

  const startMonitoring = useCallback(async () => {
    setError(null);
    setPeakLevel(0);
    setLevel(0);
    clearPreview();
    setVerdict('idle');
    setPhase('requesting');

    try {
      let snapshot = await refreshPermission();

      if (!snapshot.granted) {
        snapshot = await requestMicrophoneAccess();
        setPermission(snapshot);
      }

      if (!snapshot.granted) {
        setVerdict('no-permission');
        setPhase('error');
        setError('Microphone permission is not granted.');
        return;
      }

      releaseCapture();
      await acquireStream(selectedDeviceId || undefined);
      startLevelPolling();
      setVerdict('waiting-for-sound');
      setPhase('monitoring');
    } catch (captureError) {
      const message = getMediaErrorMessage(captureError);
      setError(message);
      setVerdict('error');
      setPhase('error');
      releaseCapture();
    }
  }, [
    acquireStream,
    clearPreview,
    refreshPermission,
    releaseCapture,
    selectedDeviceId,
    startLevelPolling,
  ]);

  const switchDevice = useCallback(
    async (deviceId: string) => {
      if (phase !== 'monitoring') {
        setSelectedDeviceId(deviceId);
        return;
      }

      setSelectedDeviceId(deviceId);
      setError(null);
      setPeakLevel(0);

      try {
        await finalizeSessionRecording();
        releaseCapture();
        await acquireStream(deviceId);
        startLevelPolling();
        setPhase('monitoring');
      } catch (switchError) {
        setError(getMediaErrorMessage(switchError));
        setVerdict('error');
        setPhase('error');
        releaseCapture();
      }
    },
    [acquireStream, finalizeSessionRecording, phase, releaseCapture, startLevelPolling]
  );

  useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  useEffect(() => {
    return () => {
      releaseCapture();
      revokePreviewUrl(previewUrlRef);
    };
  }, [releaseCapture]);

  return {
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
    soundThreshold: SOUND_LEVEL_THRESHOLD,
  };
}
