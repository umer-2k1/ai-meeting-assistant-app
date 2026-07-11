import { randomUUID } from 'node:crypto';
import prisma from '../lib/prisma.js';
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL } from './embeddings.js';

/**
 * SQLite-backed vector store.
 *
 * Embeddings live in the `VectorEmbedding` table alongside the rest of the app
 * data — there is no external vector database. Searches filter to a small
 * candidate set in SQL (by userId / meetingId) and then rank it with brute-force
 * cosine similarity in JS. At this app's scale (a handful of users, a few
 * hundred vectors per meeting) that is sub-millisecond, and it removes an entire
 * class of "cloud cluster suspended / bad API key" failures.
 *
 * The exported surface deliberately mirrors the previous Qdrant client so
 * callers (live.ts, meeting.ts, processing.ts) are unchanged: search results are
 * `{ id, score, payload }` objects, highest score first.
 */

const COLLECTIONS = {
  MEETINGS: 'meetings',
  TRANSCRIPTS: 'transcripts',
};

export interface VectorSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

/**
 * Always available — the store is local SQLite, so there is no external service
 * to be unreachable. Kept so callers can keep gating on it without changes.
 */
export function isVectorStoreAvailable(): boolean {
  return true;
}

// ---------------------------------------------------------------------------
// Float32 BLOB <-> number[] encoding
// ---------------------------------------------------------------------------

/** Pack an embedding into a little-endian Float32 BLOB (Uint8Array) for storage. */
function encodeVector(embedding: number[]): Uint8Array<ArrayBuffer> {
  const floats = Float32Array.from(embedding);
  // Copy the float bytes into a fresh ArrayBuffer-backed Uint8Array — exactly
  // the vector's bytes, and typed as Uint8Array<ArrayBuffer> (what Prisma's
  // Bytes column expects).
  const bytes = new Uint8Array(floats.byteLength);
  bytes.set(new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength));
  return bytes;
}

/** Decode a stored BLOB (Buffer or Uint8Array) back into a number[]. */
function decodeVector(blob: Buffer | Uint8Array): number[] {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  const floats = new Float32Array(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  );
  return Array.from(floats);
}

/** Cosine similarity of two equal-length vectors; 0 if either has no magnitude. */
function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * No-op kept for API compatibility with the previous Qdrant implementation.
 * SQLite tables are created by Prisma migrations, so there are no collections to
 * provision at runtime.
 */
export async function ensureCollections(): Promise<void> {
  // Intentionally empty.
}

/**
 * Store meeting-level embedding.
 */
export async function storeMeetingEmbedding(
  meetingId: string,
  embedding: number[],
  metadata: {
    userId: string;
    title: string;
    summary: string;
    startTime: Date;
    tags?: string[];
  }
): Promise<string> {
  const pointId = randomUUID();

  const payload = {
    meetingId,
    userId: metadata.userId,
    title: metadata.title,
    summary: metadata.summary,
    startTime: metadata.startTime.toISOString(),
    tags: metadata.tags || [],
  };

  await prisma.vectorEmbedding.create({
    data: {
      entityType: 'meeting',
      entityId: meetingId,
      pointId,
      collectionName: COLLECTIONS.MEETINGS,
      vector: encodeVector(embedding),
      payload: JSON.stringify(payload),
      userId: metadata.userId,
      meetingId,
      model: EMBEDDING_MODEL,
      dimension: EMBEDDING_DIMENSION,
    },
  });

  return pointId;
}

/**
 * Store transcript-line embedding.
 */
export async function storeTranscriptEmbedding(
  transcriptId: string,
  embedding: number[],
  metadata: {
    meetingId: string;
    speaker: string;
    text: string;
    timestamp: string;
  }
): Promise<string> {
  const pointId = randomUUID();

  const payload = {
    transcriptId,
    meetingId: metadata.meetingId,
    speaker: metadata.speaker,
    text: metadata.text,
    timestamp: metadata.timestamp,
  };

  await prisma.vectorEmbedding.create({
    data: {
      entityType: 'transcript_line',
      entityId: transcriptId,
      pointId,
      collectionName: COLLECTIONS.TRANSCRIPTS,
      vector: encodeVector(embedding),
      payload: JSON.stringify(payload),
      meetingId: metadata.meetingId,
      model: EMBEDDING_MODEL,
      dimension: EMBEDDING_DIMENSION,
    },
  });

  return pointId;
}

/** Rank a set of candidate rows against the query and return the top `limit`. */
function rankCandidates(
  candidates: { pointId: string; vector: Buffer | Uint8Array; payload: string }[],
  queryEmbedding: number[],
  limit: number
): VectorSearchResult[] {
  const scored = candidates.map((row) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      // Corrupt/legacy payload — return an empty object rather than throwing.
    }
    return {
      id: row.pointId,
      score: cosineSimilarity(decodeVector(row.vector), queryEmbedding),
      payload,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Search for similar meetings owned by `userId`.
 */
export async function searchSimilarMeetings(
  queryEmbedding: number[],
  userId: string,
  limit: number = 5
): Promise<VectorSearchResult[]> {
  const candidates = await prisma.vectorEmbedding.findMany({
    where: { collectionName: COLLECTIONS.MEETINGS, userId },
    select: { pointId: true, vector: true, payload: true },
  });

  return rankCandidates(candidates, queryEmbedding, limit);
}

/**
 * Search for relevant transcript snippets, optionally scoped to one meeting.
 */
export async function searchTranscripts(
  queryEmbedding: number[],
  meetingId?: string,
  limit: number = 10
): Promise<VectorSearchResult[]> {
  const candidates = await prisma.vectorEmbedding.findMany({
    where: {
      collectionName: COLLECTIONS.TRANSCRIPTS,
      ...(meetingId ? { meetingId } : {}),
    },
    select: { pointId: true, vector: true, payload: true },
  });

  return rankCandidates(candidates, queryEmbedding, limit);
}

/**
 * Delete all embeddings (meeting + transcript lines) for a meeting.
 */
export async function deleteMeetingEmbeddings(meetingId: string): Promise<void> {
  await prisma.vectorEmbedding.deleteMany({ where: { meetingId } });
}
