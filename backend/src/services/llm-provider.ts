/**
 * LLM provider factory.
 *
 * Single switch point for which backend powers every LLM call. Selected once at
 * boot via `LLM_PROVIDER`:
 *   - `groq` (default) — GROQ API via LangChain `ChatGroq` (unchanged behaviour).
 *   - `claude-code`     — the local `claude` CLI subscription via `ChatClaudeCode`.
 *
 * Every service (`ai.ts`, `ai-stream.ts`, `ai-agent.ts`) builds its model through
 * `createLLM`, so switching providers needs no code changes — just the env var.
 */

import { ChatGroq } from '@langchain/groq';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatClaudeCode } from '../models/chat-claude-code.js';

export type LlmProvider = 'groq' | 'claude-code';

export interface LlmOptions {
  model?: string;
  temperature?: number;
  json?: boolean;
  streaming?: boolean;
}

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

/** Resolve the active provider from env (defaults to groq). */
export function getLlmProvider(): LlmProvider {
  return process.env.LLM_PROVIDER === 'claude-code' ? 'claude-code' : 'groq';
}

/**
 * Build a LangChain chat model for the active provider. The return type is
 * `BaseChatModel`, which both providers satisfy — supporting `.invoke()`,
 * `.stream()`, `.pipe()`, and `.bindTools()` at every call site.
 */
export function createLLM(options: LlmOptions = {}): BaseChatModel {
  if (getLlmProvider() === 'claude-code') {
    // The CLI has no temperature/response_format knobs; JSON is prompt-enforced
    // and tolerated by the llm-json repair layer.
    return new ChatClaudeCode({
      model: options.model,
      streaming: options.streaming,
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  return new ChatGroq({
    apiKey,
    model: options.model || DEFAULT_GROQ_MODEL,
    temperature: options.temperature ?? 0.7,
    ...(options.streaming ? { streaming: true } : {}),
    // Groq JSON mode forces a syntactically valid JSON object response.
    ...(options.json ? { modelKwargs: { response_format: { type: 'json_object' } } } : {}),
  });
}
