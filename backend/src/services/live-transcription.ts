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
import { createLogger, shortId } from '../lib/logger.js';

const log = createLogger('transcribe');

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

/** A stretch of consecutive words attributed to one diarized speaker. */
export interface SpeakerRun {
  speaker: string;
  text: string;
  startSeconds: number;
}

/** Deepgram's per-word shape, narrowed to what diarization needs. */
type DeepgramWord = {
  start?: number;
  speaker?: number;
  word?: string;
  punctuated_word?: string;
};

/**
 * Split a Deepgram result's words into consecutive same-speaker runs.
 *
 * Deepgram diarizes PER WORD, but a single result can contain several speakers
 * when people talk over/straight after each other. Reading only `words[0]`
 * attributed the whole segment to whoever happened to speak first — which is how
 * an entire fast-moving conversation collapsed onto "Speaker 1".
 *
 * A word with no `speaker` continues the current run rather than starting a new
 * one: sporadic missing labels should not fragment a line.
 */
export function groupWordsBySpeaker(
  words: DeepgramWord[] | undefined,
  fallbackSpeaker = 'Speaker 1'
): SpeakerRun[] {
  if (!words || words.length === 0) return [];

  const runs: SpeakerRun[] = [];
  let current: SpeakerRun | null = null;
  let currentIdx: number | null = null;

  for (const word of words) {
    const token = (word.punctuated_word ?? word.word ?? '').trim();
    if (!token) continue;

    const idx = typeof word.speaker === 'number' ? word.speaker : null;
    // `null` (unlabelled) never forces a boundary — only a *different* label does.
    const startsNewRun = current === null || (idx !== null && currentIdx !== null && idx !== currentIdx);

    if (startsNewRun) {
      current = {
        speaker: idx === null ? fallbackSpeaker : `Speaker ${idx + 1}`,
        text: token,
        // Each run carries its OWN first word's start, so per-line timestamps
        // stay correct after a split.
        startSeconds: word.start ?? 0,
      };
      currentIdx = idx;
      runs.push(current);
      continue;
    }

    current!.text = `${current!.text} ${token}`;
    // Adopt the first real label seen if the run began on unlabelled words.
    if (currentIdx === null && idx !== null) {
      currentIdx = idx;
      current!.speaker = `Speaker ${idx + 1}`;
    }
  }

  return runs;
}

const KEEPALIVE_MS = 8000;
/** Bounded reconnect on transient Deepgram drops: 3 tries, doubling delay. */
const RECONNECT_MAX_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1000;

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
  const mid = shortId(meetingId);
  log.step(`opening Deepgram session for meeting ${mid}`);

  let ready = false;
  // Count persisted final lines so the session close can report how much was
  // captured (a 0 here on a "working" recording points straight at the mic/WS).
  let linesCommitted = 0;
  const pending: Buffer[] = [];
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // The browser MediaRecorder sends one continuous WebM stream: only the FIRST
  // chunk carries the container header, so a fresh Deepgram connection can't
  // decode later chunks on their own. Keep the init chunk and replay it on
  // every reconnect.
  let initChunk: Buffer | null = null;

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
        linesCommitted += 1;
        const preview = saved.text.length > 60 ? `${saved.text.slice(0, 60)}…` : saved.text;
        log.info(`line #${linesCommitted} [${saved.timestamp} ${saved.speaker}] "${preview}" (${mid})`);
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
        log.error(`failed to persist transcript line (${mid})`, error instanceof Error ? error.message : error);
      });
  };

  /**
   * Open a Deepgram connection with all handlers attached. Called once at
   * session start and again on each reconnect attempt.
   */
  const openConnection = () => {
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

    connection.on(LiveTranscriptionEvents.Open, () => {
      ready = true;
      log.ok(`Deepgram connected — streaming audio (${mid})`);
      reconnectAttempts = 0;
      // Replay the container header on reconnects so Deepgram can decode the
      // stream, then flush audio buffered while the socket was down.
      if (initChunk && pending[0] !== initChunk) {
        connection.send(toArrayBuffer(initChunk));
      }
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
        // Split the segment on speaker changes and commit a line per speaker.
        //
        // The buffer used to flush ONLY on speech_final/UtteranceEnd, both of
        // which need ~800-1000ms of silence. In a fast back-and-forth there is
        // no such silence, so segments from different speakers concatenated into
        // one line wearing the first speaker's label. Flushing on speaker change
        // as well is what makes rapid alternation attribute correctly.
        const runs = groupWordsBySpeaker(words, utterance?.speaker ?? 'Speaker 1');

        if (runs.length === 0 && text) {
          // No word-level data (rare) — keep the previous behaviour.
          if (utterance) {
            utterance.text = `${utterance.text} ${text}`.trim();
          } else {
            utterance = { text, startSeconds, speaker: detectedSpeaker ?? 'Speaker 1' };
          }
        }

        for (const run of runs) {
          if (utterance && utterance.speaker !== run.speaker) {
            // Speaker changed mid-stream: close the previous line before opening
            // the next, instead of appending across the boundary.
            commitUtterance();
          }
          if (utterance) {
            utterance.text = `${utterance.text} ${run.text}`.trim();
          } else {
            utterance = {
              text: run.text,
              startSeconds: run.startSeconds,
              speaker: run.speaker,
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
      //
      // Deliberately NOT split by speaker. Interim results get revised
      // constantly, so splitting here would make labels flicker mid-sentence.
      // Interims are never persisted, so a transient mislabel self-corrects on
      // the next final. When there is no buffer, use the LAST run's speaker —
      // whoever is talking now — rather than the first word's.
      if (!text && !utterance) return;
      const interimRuns = groupWordsBySpeaker(words);
      const trailingSpeaker = interimRuns.at(-1)?.speaker ?? detectedSpeaker;
      const startForLine = utterance?.startSeconds ?? startSeconds;
      const speakerForLine = utterance?.speaker ?? trailingSpeaker ?? 'Speaker 1';
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
      log.error(`Deepgram error (${mid})`, error instanceof Error ? error.message : error);
      // Close fires next and drives the reconnect; nothing to emit yet.
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      // Flush the last in-progress utterance so the final sentence isn't lost.
      commitUtterance();
      if (keepAlive) {
        clearInterval(keepAlive);
        keepAlive = null;
      }
      if (closed) return;

      // Unexpected drop while the session is still active — buffer incoming
      // audio (see sendAudio) and retry with doubling backoff.
      ready = false;
      if (reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
        emit({
          type: 'error',
          message: 'Transcription connection lost. Stop and restart the recording to resume.',
        });
        return;
      }
      reconnectAttempts += 1;
      const delay = RECONNECT_BASE_DELAY_MS * 2 ** (reconnectAttempts - 1);
      log.warn(
        `connection dropped; reconnect ${reconnectAttempts}/${RECONNECT_MAX_ATTEMPTS} in ${delay}ms (${mid})`
      );
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!closed) activeConnection = openConnection();
      }, delay);
    });

    return connection;
  };

  let activeConnection = openConnection();

  return {
    sendAudio(chunk: Buffer) {
      if (closed) return;
      if (!initChunk) initChunk = chunk;
      if (ready) {
        try {
          activeConnection.send(toArrayBuffer(chunk));
        } catch (error) {
          log.error(`audio send to Deepgram failed (${mid})`, error instanceof Error ? error.message : error);
        }
      } else {
        pending.push(chunk);
      }
    },
    close() {
      if (closed) return;
      closed = true;
      log.info(`session closed for meeting ${mid} — ${linesCommitted} transcript line(s) captured`);
      if (keepAlive) clearInterval(keepAlive);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        activeConnection.requestClose();
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
      words?: Array<{
        start?: number;
        speaker?: number;
        word?: string;
        /** Present when `punctuate`/`smart_format` are on — prefer it for display. */
        punctuated_word?: string;
      }>;
    }>;
  };
}
