/**
 * AI Agent Service
 *
 * Wires the MCP tool registry (Calendar + Gmail) into the Groq LLM using
 * standard function-calling, so the "Ask Meeting AI" chat can actually look
 * up the user's schedule or send/search email instead of only answering
 * from static meeting context.
 */

import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { createGroqLLM } from './ai.js';
import { mcpToolRegistry } from '../mcp/tools/index.js';

const MAX_TOOL_STEPS = 4;

export interface AgentMeetingContext {
  transcript?: string;
  summary?: string;
  actionItems?: string;
}

export interface AgentToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface AgentAnswer {
  answer: string;
  toolCalls?: AgentToolCallRecord[];
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function contentToString(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : (part as { text?: string })?.text ?? ''))
      .join('');
  }
  return content ? JSON.stringify(content) : '';
}

function buildSystemPrompt(context: AgentMeetingContext): string {
  return `You are an AI meeting assistant embedded in a meeting copilot app.

You have access to tools that can read the user's Google Calendar and Gmail, when those are connected. Use them when the question requires live information you don't already have (e.g. "what's on my calendar today", "email the team a follow-up", "find emails about the pricing deal").

Rules:
- If a tool result indicates the integration is not connected (e.g. an error mentioning "not found or inactive"), tell the user to connect it from Settings -> Integrations. Do not make up calendar or email data.
- Prefer the meeting context below for questions about THIS meeting's transcript, summary, or action items — you don't need a tool for that.
- Keep answers concise and concrete. If you cite a moment from the transcript, include its timestamp if available.

Meeting context:
Summary: ${context.summary || 'N/A'}

Transcript:
${context.transcript || 'N/A'}

Action Items:
${context.actionItems || 'N/A'}`;
}

/**
 * Answer a question using the Groq LLM, letting it call Calendar/Gmail MCP
 * tools (bound to `userId`) as needed before producing a final answer.
 */
export async function answerWithTools(
  userId: string,
  question: string,
  context: AgentMeetingContext = {}
): Promise<AgentAnswer> {
  const tools = mcpToolRegistry.getLangChainTools(userId);
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  const llm = createGroqLLM({ temperature: 0.3 });
  const llmWithTools = tools.length > 0 ? llm.bindTools(tools) : llm;

  const messages: BaseMessage[] = [
    new SystemMessage(buildSystemPrompt(context)),
    new HumanMessage(question),
  ];

  const toolCallLog: AgentToolCallRecord[] = [];

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const response = (await llmWithTools.invoke(messages)) as AIMessage;
    messages.push(response);

    const calls = response.tool_calls ?? [];
    if (calls.length === 0) {
      return {
        answer: contentToString(response.content),
        toolCalls: toolCallLog.length > 0 ? toolCallLog : undefined,
      };
    }

    for (const call of calls) {
      const selectedTool = toolByName.get(call.name);
      const args = (call.args ?? {}) as Record<string, unknown>;

      let resultText: string;
      if (!selectedTool) {
        resultText = JSON.stringify({ success: false, error: `Unknown tool: ${call.name}` });
      } else {
        try {
          resultText = (await selectedTool.invoke(args)) as string;
        } catch (error) {
          resultText = JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Tool execution failed',
          });
        }
      }

      toolCallLog.push({ name: call.name, args, result: safeParseJson(resultText) });
      messages.push(new ToolMessage({ content: resultText, tool_call_id: call.id ?? call.name }));
    }
  }

  // Exhausted tool-call budget — ask once more without tools for a final answer
  // grounded in whatever the tools already returned.
  const finalResponse = await createGroqLLM({ temperature: 0.3 }).invoke(messages);
  return {
    answer: contentToString(finalResponse.content),
    toolCalls: toolCallLog.length > 0 ? toolCallLog : undefined,
  };
}
