import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { extractJsonBlock, invokeJson } from '../lib/llm-json.js';
import { createLLM } from './llm-provider.js';

/**
 * Initialize the LLM client for the active provider (GROQ or Claude Code).
 *
 * Kept named `createGroqLLM` for call-site compatibility; provider selection now
 * lives in `createLLM` (see llm-provider.ts, driven by `LLM_PROVIDER`).
 */
export function createGroqLLM(options: {
  model?: string;
  temperature?: number;
  json?: boolean;
} = {}) {
  return createLLM(options);
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
  const llm = createGroqLLM({ temperature: 0.4, json: true });

  const lengthHint =
    options?.length === 'brief'
      ? 'a tight 2-3 sentence executive summary capturing the essence of the meeting'
      : options?.length === 'detailed'
        ? 'a comprehensive executive summary of 3-4 full paragraphs that walks through the context, the main topics discussed in the order they came up, the reasoning behind conclusions, and where things were left — written so someone who missed the meeting fully understands what happened'
        : 'a substantive executive summary of 1-2 full paragraphs covering the purpose, the main topics, and the outcomes';

  const pointCount = options?.length === 'brief' ? '3-4' : '5-8';

  const prompt = ChatPromptTemplate.fromTemplate(`
You are an expert AI meeting assistant. Read the meeting transcript carefully and produce a rich, accurate briefing. Never invent facts not present in the transcript. Write in clear, professional prose.

Produce:
1. summary: {lengthHint}. Separate paragraphs with \\n.
2. keyPoints: {pointCount} specific, self-contained bullet points covering the substantive discussion — topics, arguments, data mentioned, agreements, and open questions. Each bullet is a full, informative sentence, not a fragment.
3. decisions: every explicit decision or commitment made (empty array if none).
4. risks: risks, blockers, concerns, or dependencies raised (empty array if none).

Transcript:
{transcript}

Respond ONLY with a single valid JSON object of this exact shape. All string values MUST be wrapped in double quotes and any line breaks inside a string MUST be written as \\n:
{{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "decisions": ["...", "..."],
  "risks": ["...", "..."]
}}
`);

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  try {
    return await invokeJson(
      () => chain.invoke({ transcript, lengthHint, pointCount }),
      summarySchema,
      'meeting summary'
    );
  } catch (error) {
    // The structured call still produced invalid JSON (Groq's JSON mode is
    // best-effort and longer summaries break it more often). Rather than fail
    // the whole meeting, degrade gracefully: get the summary as plain text
    // (no JSON to break) and return it with empty structured lists.
    console.warn('[ai] summary JSON failed, falling back to plain-text summary:', error);
    const plainLlm = createGroqLLM({ temperature: 0.4 });
    const plainPrompt = ChatPromptTemplate.fromTemplate(`
You are an expert AI meeting assistant. Write {lengthHint} of the following meeting transcript. Use plain prose (no headings, no JSON, no markdown). Never invent facts not present in the transcript.

Transcript:
{transcript}
`);
    const summary = (
      await plainPrompt.pipe(plainLlm).pipe(new StringOutputParser()).invoke({
        transcript,
        lengthHint,
      })
    ).trim();
    return { summary, keyPoints: [], decisions: [], risks: [] };
  }
}

/**
 * Assemble a rich HTML summary (Tiptap-compatible) from the structured summary
 * result. Rendered directly in the Summary tab so it shows everything — exec
 * summary, key points, decisions, risks — not just a bare paragraph.
 */
export function renderSummaryHtml(result: {
  summary: string;
  keyPoints?: string[];
  decisions?: string[];
  risks?: string[];
}): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const list = (items?: string[]) =>
    items && items.length > 0
      ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
      : '';
  const section = (title: string, body: string) =>
    body ? `<h3>${title}</h3>${body}` : '';

  const summaryParas = result.summary
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');

  return [
    '<h2>Executive summary</h2>',
    summaryParas || `<p>${esc(result.summary)}</p>`,
    section('Key points', list(result.keyPoints)),
    section('Key decisions', list(result.decisions)),
    section('Risks &amp; blockers', list(result.risks)),
  ]
    .filter(Boolean)
    .join('\n');
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
  /** Still-open commitments from past meetings with these people. */
  openActionItems?: string;
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

Previous Meeting Context (past meetings with these people, including decisions already made):
{previousContext}

Still-open action items from those meetings:
{openActionItems}

Provide:
1. A brief overview (2-3 sentences). If decisions were already made with these
   people, say what they were — the user needs to walk in knowing what is settled.
2. Suggested discussion topics (3-5 bullet points)
3. Important reminders or follow-ups

Rules for reminders:
- Ground them in the open action items and decisions listed above. Name the
  specific commitment and who owns it.
- Do NOT invent commitments, deadlines, or decisions that are not listed. If
  there are no open items and no prior decisions, return an empty reminders list
  rather than inventing plausible-sounding ones.

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
        openActionItems: data.openActionItems || 'None outstanding',
      }),
    preMeetingBriefSchema,
    'pre-meeting brief'
  );
}
