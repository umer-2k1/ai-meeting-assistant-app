import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Initialize Groq LLM client
 */
export function createGroqLLM(options: {
  model?: string;
  temperature?: number;
} = {}) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  return new ChatGroq({
    apiKey: GROQ_API_KEY,
    model: options.model || 'llama-3.3-70b-versatile',
    temperature: options.temperature ?? 0.7,
  });
}

/**
 * Generate meeting summary from transcript
 */
export async function generateMeetingSummary(transcript: string): Promise<{
  summary: string;
  keyPoints: string[];
  decisions: string[];
  risks: string[];
}> {
  const llm = createGroqLLM({ temperature: 0.5 });

  const prompt = ChatPromptTemplate.fromTemplate(`
You are an AI meeting assistant. Analyze the following meeting transcript and provide:

1. A concise executive summary (2-3 sentences)
2. Key discussion points (3-5 bullet points)
3. Decisions made (list all explicit decisions)
4. Risks or blockers identified (if any)

Transcript:
{transcript}

Respond in JSON format:
{{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "decisions": ["...", "..."],
  "risks": ["...", "..."]
}}
`);

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());

  const result = await chain.invoke({ transcript });

  try {
    return JSON.parse(result);
  } catch {
    // Fallback if JSON parsing fails
    return {
      summary: result.substring(0, 500),
      keyPoints: [],
      decisions: [],
      risks: [],
    };
  }
}

/**
 * Extract action items from transcript
 */
export async function extractActionItems(transcript: string): Promise<
  Array<{
    task: string;
    assignee?: string;
    dueDate?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }>
> {
  const llm = createGroqLLM({ temperature: 0.3 });

  const prompt = ChatPromptTemplate.fromTemplate(`
You are an AI meeting assistant. Extract all action items from the following transcript.

For each action item, identify:
- Task description
- Assignee (if mentioned)
- Due date (if mentioned)
- Priority (HIGH, MEDIUM, or LOW)

Transcript:
{transcript}

Respond in JSON format as an array:
[
  {{
    "task": "...",
    "assignee": "...",
    "dueDate": "...",
    "priority": "MEDIUM"
  }}
]
`);

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());

  const result = await chain.invoke({ transcript });

  try {
    return JSON.parse(result);
  } catch {
    return [];
  }
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

  try {
    return JSON.parse(result);
  } catch {
    return {
      answer: result,
    };
  }
}

/**
 * Generate pre-meeting brief
 */
export async function generatePreMeetingBrief(data: {
  title: string;
  description?: string;
  attendees: Array<{ name: string; role?: string; company?: string }>;
  previousMeetings?: string;
}): Promise<{
  briefing: string;
  suggestedTopics: string[];
  reminders: string[];
}> {
  const llm = createGroqLLM({ temperature: 0.6 });

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

  const result = await chain.invoke({
    title: data.title,
    description: data.description || 'No description provided',
    attendees: attendeesList,
    previousContext: data.previousMeetings || 'No previous meetings',
  });

  try {
    return JSON.parse(result);
  } catch {
    return {
      briefing: result,
      suggestedTopics: [],
      reminders: [],
    };
  }
}
