import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullAnswer: string, metadata?: { timestamp?: string; tokensUsed?: number; responseTime?: number }) => void;
  onError: (error: Error) => void;
}

/**
 * Answer meeting question with streaming responses (SSE)
 */
export async function answerMeetingQuestionStream(
  question: string,
  context: {
    transcript?: string;
    summary?: string;
    actionItems?: string;
  },
  callbacks: StreamCallbacks
): Promise<void> {
  if (!GROQ_API_KEY) {
    callbacks.onError(new Error('GROQ_API_KEY not configured'));
    return;
  }

  const startTime = Date.now();
  let fullAnswer = '';
  let tokensUsed = 0;

  try {
    const llm = new ChatGroq({
      apiKey: GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      streaming: true,
    });

    const contextStr = `
Meeting Summary: ${context.summary || 'N/A'}

Transcript:
${context.transcript || 'N/A'}

Action Items:
${context.actionItems || 'N/A'}
`;

    const prompt = ChatPromptTemplate.fromTemplate(`
You are an AI meeting assistant. Answer the following question based on the meeting context provided.

If the question asks about a specific moment or topic, try to identify the relevant timestamp.

Context:
{context}

Question: {question}

Provide a concise, accurate answer. If you mention a specific moment, include the timestamp.

Answer directly without JSON formatting.
`);

    const chain = prompt.pipe(llm);

    const stream = await chain.stream({
      context: contextStr,
      question,
    });

    // Stream tokens
    for await (const chunk of stream) {
      const content = chunk.content as string;
      if (content) {
        fullAnswer += content;
        tokensUsed += 1; // Approximate
        callbacks.onToken(content);
      }
    }

    const responseTime = Date.now() - startTime;

    // Extract timestamp if mentioned in answer
    const timestampMatch = fullAnswer.match(/\d{2}:\d{2}:\d{2}/);
    const timestamp = timestampMatch ? timestampMatch[0] : undefined;

    callbacks.onComplete(fullAnswer, {
      timestamp,
      tokensUsed,
      responseTime,
    });
  } catch (error) {
    console.error('Streaming error:', error);
    callbacks.onError(error as Error);
  }
}

/**
 * Generate meeting summary with streaming
 */
export async function generateMeetingSummaryStream(
  transcript: string,
  callbacks: StreamCallbacks
): Promise<void> {
  if (!GROQ_API_KEY) {
    callbacks.onError(new Error('GROQ_API_KEY not configured'));
    return;
  }

  const startTime = Date.now();
  let fullAnswer = '';

  try {
    const llm = new ChatGroq({
      apiKey: GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      streaming: true,
    });

    const prompt = ChatPromptTemplate.fromTemplate(`
You are an AI meeting assistant. Analyze the following meeting transcript and provide:

1. A concise executive summary (2-3 sentences)
2. Key discussion points (3-5 bullet points)
3. Decisions made (list all explicit decisions)
4. Risks or blockers identified (if any)

Transcript:
{transcript}

Respond in a clear, structured format.
`);

    const chain = prompt.pipe(llm);
    const stream = await chain.stream({ transcript });

    for await (const chunk of stream) {
      const content = chunk.content as string;
      if (content) {
        fullAnswer += content;
        callbacks.onToken(content);
      }
    }

    const responseTime = Date.now() - startTime;
    callbacks.onComplete(fullAnswer, { responseTime });
  } catch (error) {
    console.error('Streaming error:', error);
    callbacks.onError(error as Error);
  }
}
