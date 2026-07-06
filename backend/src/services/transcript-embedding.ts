/**
 * Shared transcript-line embedding pipeline.
 *
 * Embeds a transcript line (Gemini) → stores the vector in Qdrant (UUID point
 * id) → records the mapping on the TranscriptLine + VectorEmbedding tables.
 * Used by both the REST transcript endpoint and the live WebSocket pipeline.
 */
import prisma from '../lib/prisma.js';
import { embedTranscriptChunk, EMBEDDING_DIMENSION } from './embeddings.js';
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

  const pointId = await storeTranscriptEmbedding(line.id, embedding, {
    meetingId: line.meetingId,
    speaker: line.speaker,
    text: line.text,
    timestamp: line.timestamp,
  });

  await prisma.transcriptLine
    .update({ where: { id: line.id }, data: { embeddingId: pointId } })
    .catch(() => {});

  await prisma.vectorEmbedding.create({
    data: {
      entityType: 'transcript_line',
      entityId: line.id,
      qdrantId: pointId,
      collectionName: 'transcripts',
      model: 'gemini',
      dimension: EMBEDDING_DIMENSION,
    },
  });
}

/**
 * Fire-and-forget embedding: runs in the background and never rejects into the
 * caller, so transcription latency is unaffected and Qdrant/Gemini outages
 * degrade gracefully.
 */
export function embedTranscriptLineInBackground(line: EmbeddableLine): void {
  embedTranscriptLine(line).catch((error) => {
    console.error('[embed] transcript line failed:', error);
  });
}
