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

const DEFAULT_TIMESTAMP = '00:01:02';

function buildFallbackAnswer({
  question,
  transcript,
  actionItems
}: Pick<AskPayload, 'question' | 'transcript' | 'actionItems'>): AskMeetingResponse {
  const normalizedQuestion = question.toLowerCase();

  if (normalizedQuestion.includes('action')) {
    if (actionItems.length === 0) {
      return {
        answer: 'No explicit action items are detected yet in this meeting context.',
        timestamp: DEFAULT_TIMESTAMP,
        provider: 'fallback'
      };
    }

    const summary = actionItems
      .slice(0, 3)
      .map((item) => `@${item.assignee}: ${item.task} (${item.due})`)
      .join('; ');

    return {
      answer: `Here are the top action items I found: ${summary}.`,
      timestamp: actionItems[0]?.timestamp ?? DEFAULT_TIMESTAMP,
      provider: 'fallback'
    };
  }

  if (normalizedQuestion.includes('disagree') || normalizedQuestion.includes('timeline')) {
    const disagreement = transcript.find((line) => {
      const text = line.text.toLowerCase();
      return text.includes('disagree') || text.includes('concern') || text.includes('timeline');
    });

    if (disagreement) {
      return {
        answer: `${disagreement.speaker} raised a concern: "${disagreement.text}"`,
        timestamp: disagreement.timestamp,
        provider: 'fallback'
      };
    }
  }

  if (normalizedQuestion.includes('who') && normalizedQuestion.includes('pricing')) {
    return {
      answer:
        'Sarah mentioned pricing and requested a review of the enterprise tier before Q3 planning.',
      timestamp: '00:14:32',
      provider: 'fallback'
    };
  }

  const latest = transcript.at(-1);
  return {
    answer:
      latest?.text ??
      'The team aligned on Q3 priorities, Dark Mode planning, and API latency risk management.',
    timestamp: latest?.timestamp ?? DEFAULT_TIMESTAMP,
    provider: 'fallback'
  };
}

export async function askMeetingQuestion(payload: AskPayload): Promise<AskMeetingResponse> {
  const backendUrl = import.meta.env['VITE_BACKEND_URL'] ?? 'http://localhost:4000';

  const timeout = AbortSignal.timeout(4000);
  const response = await fetch(`${backendUrl}/api/ask-meeting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: timeout
  }).catch(() => null);

  if (!response || !response.ok) {
    return buildFallbackAnswer(payload);
  }

  const data: unknown = await response.json().catch(() => null);
  if (
    data &&
    typeof data === 'object' &&
    'answer' in data &&
    typeof data.answer === 'string' &&
    'timestamp' in data &&
    typeof data.timestamp === 'string'
  ) {
    return {
      answer: data.answer,
      timestamp: data.timestamp,
      provider: 'backend'
    };
  }

  return buildFallbackAnswer(payload);
}
