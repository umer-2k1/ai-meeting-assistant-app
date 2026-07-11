/**
 * Shared transcript-line embedding pipeline.
 *
 * Embeds a transcript line (Gemini) → stores the vector in the SQLite vector
 * store (VectorEmbedding row, UUID point id) → points the TranscriptLine at it.
 * Used by both the REST transcript endpoint and the live WebSocket pipeline.
 */
import prisma from '../lib/prisma.js';
import { embedTranscriptChunk } from './embeddings.js';
import { storeTranscriptEmbedding } from './vector-store.js';

export interface EmbeddableLine {
  id: string;
  meetingId: string;
  speaker: string;
  text: string;
  timestamp: string;
}

export async function embedTranscriptLine(line: EmbeddableLine): Promise<void> {
  const embedding = await embedTranscriptChunk({
    speaker: line.speaker,
    text: line.text,
    timestamp: line.timestamp,
  });

  // storeTranscriptEmbedding persists the VectorEmbedding row (vector + payload);
  // here we just point the transcript line at it.
  const pointId = await storeTranscriptEmbedding(line.id, embedding, {
    meetingId: line.meetingId,
    speaker: line.speaker,
    text: line.text,
    timestamp: line.timestamp,
  });

  await prisma.transcriptLine
    .update({ where: { id: line.id }, data: { embeddingId: pointId } })
    .catch(() => {});
}

/**
 * Fire-and-forget embedding: runs in the background and never rejects into the
 * caller, so transcription latency is unaffected and a Gemini outage degrades
 * gracefully.
 */
export function embedTranscriptLineInBackground(line: EmbeddableLine): void {
  embedTranscriptLine(line).catch((error) => {
    console.error('[embed] transcript line failed:', error);
  });
}
