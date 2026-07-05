import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { extractJsonBlock, invokeJson } from '../lib/llm-json.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Initialize Groq LLM client
 */
export function createGroqLLM(options: {
  model?: string;
  temperature?: number;
  json?: boolean;
} = {}) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  return new ChatGroq({
    apiKey: GROQ_API_KEY,
    model: options.model || 'llama-3.3-70b-versatile',
    temperature: options.temperature ?? 0.7,
    // Groq JSON mode forces a syntactically valid JSON object response.
    ...(options.json
      ? { modelKwargs: { response_format: { type: 'json_object' } } }
      : {}),
  });
}

/**
 * Generate meeting summary from transcript
 */
const summarySchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

export async function generateMeetingSummary(
  transcript: string,
  options?: { length?: 'brief' | 'balanced' | 'detailed' }
): Promise<z.infer<typeof summarySchema>> {
  const llm = createGroqLLM({ temperature: 0.5, json: true });

  const lengthHint =
    options?.length === 'brief'
      ? 'a very short 1-2 sentence executive summary'
      : options?.length === 'detailed'
        ? 'a thorough executive summary of one short paragraph'
        : 'a concise 2-3 sentence executive summary';

  const prompt = ChatPromptTemplate.fromTemplate(`
You are an AI meeting assistant. Analyze the following meeting transcript and provide:

1. {lengthHint}
2. Key discussion points (3-5 bullet points)
3. Decisions made (list all explicit decisions)
4. Risks or blockers identified (if any)

Transcript:
{transcript}

Respond ONLY with a JSON object of this exact shape:
{{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "decisions": ["...", "..."],
  "risks": ["...", "..."]
}}
`);

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  return invokeJson(
    () => chain.invoke({ transcript, lengthHint }),
    summarySchema,
    'meeting summary'
  );
}

/**
 * Extract action items from transcript
 */
const actionItemsSchema = z.object({
  items: z
    .array(
      z.object({
        task: z.string(),
        assignee: z.string().nullish(),
        dueDate: z.string().nullish(),
        priority: z
          .enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
          .catch('MEDIUM')
          .default('MEDIUM'),
      })
    )
    .default([]),
});

export async function extractActionItems(
  transcript: string,
  options?: { sensitivity?: 'conservative' | 'balanced' | 'aggressive' }
): Promise<
  Array<{
    task: string;
    assignee?: string;
    dueDate?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  }>
> {
  const llm = createGroqLLM({ temperature: 0.3, json: true });

  const sensitivityHint =
    options?.sensitivity === 'conservative'
      ? 'Only include clear, explicitly-stated action items.'
      : options?.sensitivity === 'aggressive'
        ? 'Include implied or potential action items in addition to explicit ones.'
        : 'Include reasonably clear action items.';

  const prompt = ChatPromptTemplate.fromTemplate(`
You are an AI meeting assistant. Extract action items from the following transcript.
{sensitivityHint}

For each action item, identify:
- Task description
- Assignee (if mentioned)
- Due date in ISO 8601 (YYYY-MM-DD) if mentioned, otherwise null
- Priority (HIGH, MEDIUM, or LOW)

Transcript:
{transcript}

Respond ONLY with a JSON object whose "items" is an array (empty if there are no
action items):
{{
  "items": [
    {{ "task": "...", "assignee": "..." or null, "dueDate": "YYYY-MM-DD" or null, "priority": "MEDIUM" }}
  ]
}}
`);

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const { items } = await invokeJson(
    () => chain.invoke({ transcript, sensitivityHint }),
    actionItemsSchema,
    'action items'
  );
  return items.map((i) => ({
    task: i.task,
    assignee: i.assignee ?? undefined,
    dueDate: i.dueDate ?? undefined,
    priority: i.priority,
  }));
}

/**
 * Generate a short human title + topic tags for a processed meeting.
 * Runs off the already-generated summary (cheap, no full re-read of transcript).
 */
const titleTagsSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()).default([]),
});

export async function generateMeetingTitleAndTags(input: {
  summary: string;
  keyPoints: string[];
  decisions: string[];
}): Promise<{ title: string; tags: string[] }> {
  const llm = createGroqLLM({ temperature: 0.4, json: true });

  const prompt = ChatPromptTemplate.fromTemplate(`
You name meetings. Given a meeting summary, produce:
1. "title": a concise 3-5 word title in Title Case (no quotes, no trailing punctuation).
2. "tags": 2-4 short topic tags, each lowercase, one or two words.

Summary: {summary}
Key points: {keyPoints}
Decisions: {decisions}

Respond ONLY with a JSON object of this exact shape:
{{ "title": "...", "tags": ["...", "..."] }}
`);

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const result = await invokeJson(
    () =>
      chain.invoke({
        summary: input.summary,
        keyPoints: input.keyPoints.join('; ') || 'none',
        decisions: input.decisions.join('; ') || 'none',
      }),
    titleTagsSchema,
    'meeting title and tags'
  );

  return {
    title: result.title.trim().replace(/^["']|["']$/g, '').slice(0, 80),
    tags: Array.from(
      new Set(result.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))
    ).slice(0, 4),
  };
}

/**
 * Answer question about meeting using RAG
 */
export async function answerMeetingQuestion(
  question: string,
  context: {
    transcript?: string;
    summary?: string;
    actionItems?: string;
  }
): Promise<{
  answer: string;
  timestamp?: string;
}> {
  const llm = createGroqLLM();

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

Respond in JSON format:
{{
  "answer": "...",
  "timestamp": "00:12:34" or null
}}
`);

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());

  const result = await chain.invoke({
    context: contextStr,
    question,
  });

  // Chat answers degrade to plain text rather than hard-failing.
  try {
    const parsed = JSON.parse(extractJsonBlock(result)) as {
      answer?: string;
      timestamp?: string | null;
    };
    return {
      answer: parsed.answer ?? result,
      timestamp: parsed.timestamp ?? undefined,
    };
  } catch {
    return { answer: result };
  }
}

/**
 * Generate pre-meeting brief
 */
const preMeetingBriefSchema = z.object({
  briefing: z.string(),
  suggestedTopics: z.array(z.string()).default([]),
  reminders: z.array(z.string()).default([]),
});

export async function generatePreMeetingBrief(data: {
  title: string;
  description?: string;
  attendees: Array<{ name: string; role?: string; company?: string }>;
  previousMeetings?: string;
}): Promise<z.infer<typeof preMeetingBriefSchema>> {
  const llm = createGroqLLM({ temperature: 0.6, json: true });

  const attendeesList = data.attendees
    .map((a) => `- ${a.name}${a.role ? ` (${a.role})` : ''}${a.company ? ` at ${a.company}` : ''}`)
    .join('\n');

  const prompt = ChatPromptTemplate.fromTemplate(`
You are an AI meeting assistant. Generate a pre-meeting brief for the following meeting:

Meeting Title: {title}
Description: {description}

Attendees:
{attendees}

Previous Meeting Context:
{previousContext}

Provide:
1. A brief overview (2-3 sentences)
2. Suggested discussion topics (3-5 bullet points)
3. Important reminders or follow-ups (if applicable)

Respond in JSON format:
{{
  "briefing": "...",
  "suggestedTopics": ["...", "..."],
  "reminders": ["...", "..."]
}}
`);

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());

  return invokeJson(
    () =>
      chain.invoke({
        title: data.title,
        description: data.description || 'No description provided',
        attendees: attendeesList,
        previousContext: data.previousMeetings || 'No previous meetings',
      }),
    preMeetingBriefSchema,
    'pre-meeting brief'
  );
}
