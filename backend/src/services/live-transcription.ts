/**
 * Live transcription bridge (Deepgram streaming).
 *
 * One session per WebSocket connection. Binary audio frames from the client are
 * forwarded to Deepgram; final transcripts are persisted as TranscriptLines
 * (with diarized speaker labels + timestamps), embedded in the background, and
 * broadcast back to the client. Interim results are broadcast but not persisted.
 */
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { addTranscriptLine } from './meeting.js';
import { embedTranscriptLineInBackground } from './transcript-embedding.js';

export interface LiveTranscriptLine {
  id?: string;
  speaker: string;
  text: string;
  timestamp: string;
  timestampSeconds: number;
}

export type TranscriptMessage =
  | { type: 'ready' }
  | { type: 'transcript'; line: LiveTranscriptLine; isFinal: boolean }
  | { type: 'error'; message: string };

interface SessionOptions {
  meetingId: string;
  /** Broadcast a message to the connected client. */
  emit: (message: TranscriptMessage) => void;
}

/** Format seconds-from-start as HH:MM:SS. */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600).toString().padStart(2, '0');
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

const KEEPALIVE_MS = 8000;

/** Copy a Node Buffer into a standalone ArrayBuffer (Deepgram accepts ArrayBufferLike). */
function toArrayBuffer(chunk: Buffer): ArrayBuffer {
  return chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer;
}

export interface LiveTranscriptionSession {
  sendAudio: (chunk: Buffer) => void;
  close: () => void;
}

/**
 * Open a Deepgram live connection for a meeting. The returned session forwards
 * audio and closes the upstream connection on `close()`.
 */
export function createLiveTranscriptionSession(
  options: SessionOptions
): LiveTranscriptionSession {
  const { meetingId, emit } = options;
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

  // Container-encoded Opus (webm) from the browser MediaRecorder — do NOT set
  // `encoding`/`sample_rate`; Deepgram decodes the container itself.
  const connection = deepgram.listen.live({
    model: 'nova-2',
    language: 'en',
    diarize: true,
    interim_results: true,
    punctuate: true,
    smart_format: true,
    // Pace lines at natural pauses instead of flooding one every ~2s.
    // `endpointing` = ms of silence before Deepgram marks `speech_final`;
    // `utterance_end_ms` emits an UtteranceEnd event as a backstop for long
    // monologues. We buffer finalized segments and commit a single line per
    // utterance (Otter/Meet-style) — see the Transcript handler below.
    endpointing: 800,
    utterance_end_ms: 1000,
  });

  let ready = false;
  const pending: Buffer[] = [];
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  // Accumulate finalized segments for the current utterance; commit as ONE line
  // at a natural pause (speech_final / UtteranceEnd). This is what makes lines
  // land at sentence boundaries instead of every ~2s.
  let utterance: { text: string; startSeconds: number; speaker: string } | null = null;

  const emitInterim = () => {
    if (!utterance) return;
    emit({
      type: 'transcript',
      line: {
        speaker: utterance.speaker,
        text: utterance.text,
        timestamp: formatTimestamp(utterance.startSeconds),
        timestampSeconds: Math.floor(utterance.startSeconds),
      },
      isFinal: false,
    });
  };

  const commitUtterance = () => {
    if (!utterance) return;
    const { text, startSeconds, speaker } = utterance;
    utterance = null;
    if (!text.trim()) return;
    const timestamp = formatTimestamp(startSeconds);
    const timestampSeconds = Math.floor(startSeconds);

    void addTranscriptLine(meetingId, { speaker, text, timestamp, timestampSeconds })
      .then((saved) => {
        embedTranscriptLineInBackground({
          id: saved.id,
          meetingId,
          speaker: saved.speaker,
          text: saved.text,
          timestamp: saved.timestamp,
        });
        emit({
          type: 'transcript',
          line: {
            id: saved.id,
            speaker: saved.speaker,
            text: saved.text,
            timestamp: saved.timestamp,
            timestampSeconds: saved.timestampSeconds,
          },
          isFinal: true,
        });
      })
      .catch((error) => {
        console.error('[live-transcription] failed to persist line:', error);
      });
  };

  connection.on(LiveTranscriptionEvents.Open, () => {
    ready = true;
    // Flush any audio buffered before the socket opened.
    for (const chunk of pending) connection.send(toArrayBuffer(chunk));
    pending.length = 0;
    emit({ type: 'ready' });

    keepAlive = setInterval(() => {
      try {
        connection.keepAlive();
      } catch {
        /* ignore */
      }
    }, KEEPALIVE_MS);
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data: DeepgramTranscript) => {
    const alt = data.channel?.alternatives?.[0];
    const text = alt?.transcript?.trim() ?? '';
    const words = alt?.words ?? [];
    const startSeconds = words[0]?.start ?? 0;
    const speakerIdx = words[0]?.speaker;
    const detectedSpeaker =
      typeof speakerIdx === 'number' ? `Speaker ${speakerIdx + 1}` : null;

    if (data.is_final) {
      // Finalized segment: append to the current utterance buffer.
      if (text) {
        if (utterance) {
          utterance.text = `${utterance.text} ${text}`.trim();
        } else {
          utterance = {
            text,
            startSeconds,
            speaker: detectedSpeaker ?? 'Speaker 1',
          };
        }
      }
      // Commit the whole utterance at a natural pause; otherwise keep buffering
      // and reflect progress as a live (interim) line.
      if (data.speech_final) {
        commitUtterance();
      } else {
        emitInterim();
      }
      return;
    }

    // Interim hypothesis: show buffered text + the live partial as one line.
    if (!text && !utterance) return;
    const startForLine = utterance?.startSeconds ?? startSeconds;
    const speakerForLine = utterance?.speaker ?? detectedSpeaker ?? 'Speaker 1';
    const combined = utterance ? `${utterance.text} ${text}`.trim() : text;
    emit({
      type: 'transcript',
      line: {
        speaker: speakerForLine,
        text: combined,
        timestamp: formatTimestamp(startForLine),
        timestampSeconds: Math.floor(startForLine),
      },
      isFinal: false,
    });
  });

  // Backstop for long monologues without a clear endpoint: Deepgram fires
  // UtteranceEnd after `utterance_end_ms` of silence — commit whatever buffered.
  connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
    commitUtterance();
  });

  connection.on(LiveTranscriptionEvents.Error, (error: unknown) => {
    console.error('[live-transcription] Deepgram error:', error);
    emit({ type: 'error', message: 'Transcription error' });
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    // Flush the last in-progress utterance so the final sentence isn't lost.
    commitUtterance();
    if (keepAlive) clearInterval(keepAlive);
  });

  return {
    sendAudio(chunk: Buffer) {
      if (closed) return;
      if (ready) {
        try {
          connection.send(toArrayBuffer(chunk));
        } catch (error) {
          console.error('[live-transcription] send failed:', error);
        }
      } else {
        pending.push(chunk);
      }
    },
    close() {
      if (closed) return;
      closed = true;
      if (keepAlive) clearInterval(keepAlive);
      try {
        connection.requestClose();
      } catch {
        /* ignore */
      }
    },
  };
}

// Minimal shape of the Deepgram transcript event we consume.
interface DeepgramTranscript {
  is_final?: boolean;
  /** True at an endpoint (natural pause) — the utterance is complete. */
  speech_final?: boolean;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
      words?: Array<{ start?: number; speaker?: number }>;
    }>;
  };
}
