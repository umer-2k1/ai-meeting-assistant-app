import { BACKEND_URL, TOKEN_KEY } from '@/lib/config';
import type { ActionItem, TranscriptLine } from './types';

export type AskMeetingResponse = {
  answer: string;
  timestamp: string;
  provider: 'backend' | 'fallback';
};

type AskPayload = {
  meetingId: string;
  question: string;
  transcript: TranscriptLine[];
  actionItems: ActionItem[];
};

const DEFAULT_TIMESTAMP = '00:00:00';

/**
 * Ask the agentic meeting assistant (`/api/ask-meeting`). This hits a real Groq
 * model with Calendar/Gmail tool access. On failure it returns an honest error
 * message — never fabricated meeting content.
 */
export async function askMeetingQuestion(payload: AskPayload): Promise<AskMeetingResponse> {
  const token = localStorage.getItem(TOKEN_KEY);

  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(`${BACKEND_URL}/api/ask-meeting`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload),
    signal: timeout
  }).catch(() => null);

  if (!response || !response.ok) {
    return {
      answer: 'The assistant is unavailable right now. Please try again in a moment.',
      timestamp: DEFAULT_TIMESTAMP,
      provider: 'fallback'
    };
  }

  const data: unknown = await response.json().catch(() => null);
  if (data && typeof data === 'object' && 'answer' in data && typeof data.answer === 'string') {
    const timestamp =
      'timestamp' in data && typeof data.timestamp === 'string' ? data.timestamp : DEFAULT_TIMESTAMP;
    return { answer: data.answer, timestamp, provider: 'backend' };
  }

  return {
    answer: 'The assistant could not produce an answer. Please rephrase and try again.',
    timestamp: DEFAULT_TIMESTAMP,
    provider: 'fallback'
  };
}
