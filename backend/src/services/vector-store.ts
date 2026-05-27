import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

let qdrantClient: QdrantClient | null = null;

/**
 * Initialize Qdrant client
 */
function getQdrantClient() {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });
  }
  return qdrantClient;
}

const COLLECTIONS = {
  MEETINGS: 'meetings',
  TRANSCRIPTS: 'transcripts',
};

/**
 * Ensure collections exist
 */
export async function ensureCollections() {
  const client = getQdrantClient();

  try {
    // Create meetings collection
    const meetingsExists = await client.collectionExists(COLLECTIONS.MEETINGS);
    if (!meetingsExists) {
      await client.createCollection(COLLECTIONS.MEETINGS, {
        vectors: {
          size: 768, // Gemini embedding dimension
          distance: 'Cosine',
        },
      });
    }

    // Create transcripts collection
    const transcriptsExists = await client.collectionExists(COLLECTIONS.TRANSCRIPTS);
    if (!transcriptsExists) {
      await client.createCollection(COLLECTIONS.TRANSCRIPTS, {
        vectors: {
          size: 768,
          distance: 'Cosine',
        },
      });
    }
  } catch (error) {
    console.error('Failed to ensure Qdrant collections:', error);
    throw error;
  }
}

/**
 * Store meeting embedding in Qdrant
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
) {
  const client = getQdrantClient();

  try {
    await client.upsert(COLLECTIONS.MEETINGS, {
      points: [
        {
          id: meetingId,
          vector: embedding,
          payload: {
            meetingId,
            userId: metadata.userId,
            title: metadata.title,
            summary: metadata.summary,
            startTime: metadata.startTime.toISOString(),
            tags: metadata.tags || [],
          },
        },
      ],
    });
  } catch (error) {
    console.error('Failed to store meeting embedding:', error);
    throw error;
  }
}

/**
 * Store transcript line embedding in Qdrant
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
) {
  const client = getQdrantClient();

  try {
    await client.upsert(COLLECTIONS.TRANSCRIPTS, {
      points: [
        {
          id: transcriptId,
          vector: embedding,
          payload: {
            transcriptId,
            meetingId: metadata.meetingId,
            speaker: metadata.speaker,
            text: metadata.text,
            timestamp: metadata.timestamp,
          },
        },
      ],
    });
  } catch (error) {
    console.error('Failed to store transcript embedding:', error);
    throw error;
  }
}

/**
 * Search for similar meetings
 */
export async function searchSimilarMeetings(
  queryEmbedding: number[],
  userId: string,
  limit: number = 5
) {
  const client = getQdrantClient();

  try {
    const results = await client.search(COLLECTIONS.MEETINGS, {
      vector: queryEmbedding,
      filter: {
        must: [
          {
            key: 'userId',
            match: { value: userId },
          },
        ],
      },
      limit,
      with_payload: true,
    });

    return results;
  } catch (error) {
    console.error('Failed to search meetings:', error);
    throw error;
  }
}

/**
 * Search for relevant transcript snippets
 */
export async function searchTranscripts(
  queryEmbedding: number[],
  meetingId?: string,
  limit: number = 10
) {
  const client = getQdrantClient();

  try {
    const filter = meetingId
      ? {
          must: [
            {
              key: 'meetingId',
              match: { value: meetingId },
            },
          ],
        }
      : undefined;

    const results = await client.search(COLLECTIONS.TRANSCRIPTS, {
      vector: queryEmbedding,
      filter,
      limit,
      with_payload: true,
    });

    return results;
  } catch (error) {
    console.error('Failed to search transcripts:', error);
    throw error;
  }
}

/**
 * Delete meeting embeddings
 */
export async function deleteMeetingEmbeddings(meetingId: string) {
  const client = getQdrantClient();

  try {
    // Delete meeting embedding
    await client.delete(COLLECTIONS.MEETINGS, {
      points: [meetingId],
    });

    // Delete all transcript embeddings for this meeting
    await client.delete(COLLECTIONS.TRANSCRIPTS, {
      filter: {
        must: [
          {
            key: 'meetingId',
            match: { value: meetingId },
          },
        ],
      },
    });
  } catch (error) {
    console.error('Failed to delete embeddings:', error);
    throw error;
  }
}
