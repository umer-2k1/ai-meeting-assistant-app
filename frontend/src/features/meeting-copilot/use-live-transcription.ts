import { useCallback, useRef, useState } from 'react';

import { TOKEN_KEY, WS_BASE_URL } from '@/lib/config';
import type { TranscriptLine } from './types';

/**
 * Real live transcription: captures mic (+ system audio on desktop), mixes into
 * one stream, streams Opus chunks to the backend over WebSocket, and receives
 * persisted transcript lines (finals) plus a live interim line.
 */

type Status = 'idle' | 'connecting' | 'live' | 'error';

interface WsTranscriptMessage {
  type: 'ready' | 'transcript' | 'error';
  line?: { id?: string; speaker: string; text: string; timestamp: string };
  isFinal?: boolean;
  message?: string;
}

const WS_SUBPROTOCOL = 'meeting-stream';

function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((t) => globalThis.MediaRecorder?.isTypeSupported?.(t));
}

export interface UseLiveTranscription {
  transcript: TranscriptLine[];
  interimLine: TranscriptLine | null;
  status: Status;
  error: string | null;
  /** Begin capturing + streaming for the given meeting. */
  start: (meetingId: string, opts?: { captureSystemAudio?: boolean }) => Promise<void>;
  /**
   * Stop capture + close the stream. Resolves once the recorder has flushed
   * its final chunk, so `takeRecording()` afterwards returns the full audio.
   */
  stop: () => Promise<void>;
  /** Take the accumulated recording as a Blob (and clear it). Null if none. */
  takeRecording: () => Blob | null;
}

export function useLiveTranscription(): UseLiveTranscription {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interimLine, setInterimLine] = useState<TranscriptLine | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  // Full recording accumulated for upload/playback (separate from the WS stream).
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');

  const cleanup = useCallback(() => {
    recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();
    recorderRef.current = null;
    for (const s of streamsRef.current) s.getTracks().forEach((t) => t.stop());
    streamsRef.current = [];
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
      } catch {
        /* ignore */
      }
      wsRef.current.close();
    }
    wsRef.current = null;
  }, []);

  const stop = useCallback(async () => {
    // The final `dataavailable` fires before the recorder's `stop` event, so
    // waiting on `stop` guarantees `chunksRef` holds the complete recording.
    const recorder = recorderRef.current;
    const flushed =
      recorder && recorder.state !== 'inactive'
        ? new Promise<void>((resolve) => {
            const safety = globalThis.setTimeout(resolve, 2000);
            recorder.addEventListener(
              'stop',
              () => {
                globalThis.clearTimeout(safety);
                resolve();
              },
              { once: true }
            );
          })
        : Promise.resolve();
    cleanup();
    await flushed;
    setInterimLine(null);
    setStatus('idle');
  }, [cleanup]);

  const takeRecording = useCallback((): Blob | null => {
    if (chunksRef.current.length === 0) return null;
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    chunksRef.current = [];
    return blob;
  }, []);

  const start = useCallback(
    async (meetingId: string, opts?: { captureSystemAudio?: boolean }) => {
      setTranscript([]);
      setInterimLine(null);
      setError(null);
      setStatus('connecting');
      chunksRef.current = [];

      try {
        // 1. Acquire audio inputs.
        const streams: MediaStream[] = [];
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        streams.push(mic);

        if (opts?.captureSystemAudio) {
          try {
            const sys = await navigator.mediaDevices.getDisplayMedia({
              video: false,
              audio: true,
            });
            // If the user granted screen share but no audio track came through,
            // drop it (mic-only) rather than failing.
            if (sys.getAudioTracks().some((t) => t.readyState === 'live')) {
              streams.push(sys);
            } else {
              sys.getTracks().forEach((t) => t.stop());
            }
          } catch {
            // System audio unavailable (permission/OS) — continue mic-only.
          }
        }
        streamsRef.current = streams;

        // 2. Mix all inputs into one stream via a single AudioContext (also
        //    resamples mismatched rates for free).
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const destination = ctx.createMediaStreamDestination();
        for (const s of streams) {
          if (s.getAudioTracks().length > 0) {
            ctx.createMediaStreamSource(s).connect(destination);
          }
        }
        await ctx.resume().catch(() => undefined);

        // 3. Open the WebSocket (JWT via subprotocol).
        const token = localStorage.getItem(TOKEN_KEY) ?? '';
        const ws = new WebSocket(`${WS_BASE_URL}/api/live/${meetingId}/stream`, [
          WS_SUBPROTOCOL,
          token,
        ]);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onmessage = (event) => {
          let msg: WsTranscriptMessage;
          try {
            msg = JSON.parse(
              typeof event.data === 'string' ? event.data : ''
            ) as WsTranscriptMessage;
          } catch {
            return;
          }
          if (msg.type === 'ready') {
            setStatus('live');
          } else if (msg.type === 'error') {
            setError(msg.message ?? 'Transcription error');
          } else if (msg.type === 'transcript' && msg.line) {
            const line: TranscriptLine = {
              id: msg.line.id ?? `interim-${Date.now()}`,
              speaker: msg.line.speaker,
              text: msg.line.text,
              timestamp: msg.line.timestamp,
            };
            // Mirror the line to the floating widget (desktop only; no-op on web).
            globalThis.window.desktop?.recording.pushTranscript({
              id: line.id,
              speaker: line.speaker,
              text: line.text,
              timestamp: line.timestamp,
              isFinal: Boolean(msg.isFinal),
            });
            if (msg.isFinal) {
              setInterimLine(null);
              setTranscript((cur) =>
                cur.some((l) => l.id === line.id) ? cur : [...cur, line]
              );
            } else {
              setInterimLine(line);
            }
          }
        };

        ws.onerror = () => setError('Connection error');
        ws.onclose = () => {
          if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
        };

        // 4. Record + stream Opus chunks once the socket is open.
        const mimeType = pickMimeType();
        mimeTypeRef.current = mimeType ?? 'audio/webm';
        const recorder = new MediaRecorder(
          destination.stream,
          mimeType ? { mimeType } : undefined
        );
        recorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            // Keep every chunk for the full recording (playback), and forward
            // live to the WS for transcription when the socket is open.
            chunksRef.current.push(e.data);
            if (ws.readyState === WebSocket.OPEN) {
              void e.data.arrayBuffer().then((buf) => {
                if (ws.readyState === WebSocket.OPEN) ws.send(buf);
              });
            }
          }
        };

        ws.onopen = () => {
          // 250ms timeslices keep latency low; one recorder ⇒ one Deepgram socket.
          recorder.start(250);
        };
      } catch (err) {
        cleanup();
        setStatus('error');
        setError(
          err instanceof Error ? err.message : 'Could not start microphone capture'
        );
      }
    },
    [cleanup]
  );

  return { transcript, interimLine, status, error, start, stop, takeRecording };
}
