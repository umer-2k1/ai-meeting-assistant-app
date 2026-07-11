import { GoogleGenerativeAI } from '@google/generative-ai';
import { searchTranscripts as searchTranscriptsInStore } from './vector-store.js';

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

/**
 * Embedding model + vector dimension. `text-embedding-004` was retired (404 on
 * v1beta embedContent); `gemini-embedding-001` is its GA successor. This SDK
 * version can't request a reduced `outputDimensionality`, so we take the model's
 * native 3072-dim output and keep the stored VectorEmbedding rows in lockstep
 * via EMBEDDING_DIMENSION.
 */
export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSION = 3072;

let genAI: GoogleGenerativeAI | null = null;

/**
 * Initialize Gemini client
 */
function initializeGemini() {
  if (!GEMINI_API_KEY) {
    throw new Error('GOOGLE_GEMINI_API_KEY not configured');
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }

  return genAI;
}

/**
 * Generate embedding for text using Gemini
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = initializeGemini();

  try {
    const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text);
    
    return result.embedding.values;
  } catch (error) {
    console.error('Gemini embedding error:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings = await Promise.all(
    texts.map((text) => generateEmbedding(text))
  );
  
  return embeddings;
}

/**
 * Generate embedding for meeting transcript chunk
 */
export async function embedTranscriptChunk(chunk: {
  speaker: string;
  text: string;
  timestamp: string;
}): Promise<number[]> {
  const combinedText = `[${chunk.timestamp}] ${chunk.speaker}: ${chunk.text}`;
  return generateEmbedding(combinedText);
}

/**
 * Generate embedding for meeting summary
 */
export async function embedMeetingSummary(summary: {
  title: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
}): Promise<number[]> {
  const combinedText = `
Meeting: ${summary.title}

Summary: ${summary.summary}

Key Points:
${summary.keyPoints.join('\n- ')}

Decisions:
${summary.decisions.join('\n- ')}
  `.trim();

  return generateEmbedding(combinedText);
}

/**
 * Search transcripts using RAG (for live chat)
 * This wraps the vector store search with proper error handling
 */
export async function searchTranscripts(
  queryEmbedding: number[],
  meetingId?: string,
  limit: number = 10
) {
  return searchTranscriptsInStore(queryEmbedding, meetingId, limit);
}
