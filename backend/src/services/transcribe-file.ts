/**
 * Pre-recorded (batch) transcription for the "Import Audio" flow. Uses the same
 * Deepgram nova-2 + diarization as the live pipeline, but over a whole uploaded
 * file at once. Returns diarized lines ready for `addTranscriptLine`.
 */
import { createClient } from '@deepgram/sdk';
import { formatTimestamp } from './live-transcription.js';

export interface TranscribedLine {
  speaker: string;
  text: string;
  timestamp: string;
  timestampSeconds: number;
}

export async function transcribeAudioBuffer(buffer: Buffer): Promise<TranscribedLine[]> {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(buffer, {
    model: 'nova-2',
    language: 'en',
    diarize: true,
    punctuate: true,
    smart_format: true,
    utterances: true, // group into speaker-labelled utterances
  });

  if (error) throw error;

  // Prefer utterances (one line per spoken segment with speaker + start time).
  const utterances = result?.results?.utterances ?? [];
  if (utterances.length > 0) {
    return utterances
      .filter((u) => u.transcript?.trim())
      .map((u) => {
        const start = u.start ?? 0;
        const speaker =
          typeof u.speaker === 'number' ? `Speaker ${u.speaker + 1}` : 'Speaker 1';
        return {
          speaker,
          text: u.transcript.trim(),
          timestamp: formatTimestamp(start),
          timestampSeconds: Math.floor(start),
        };
      });
  }

  // Fallback: whole transcript as a single line.
  const alt = result?.results?.channels?.[0]?.alternatives?.[0];
  const text = alt?.transcript?.trim();
  if (text) {
    return [{ speaker: 'Speaker 1', text, timestamp: formatTimestamp(0), timestampSeconds: 0 }];
  }

  return [];
}
