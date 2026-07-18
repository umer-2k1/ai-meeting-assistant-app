/**
 * ChatClaudeCode — a LangChain chat model backed by the local `claude` CLI.
 *
 * Lets the backend run its LLM calls through a Claude Code *subscription*
 * (via `claude -p`) instead of the GROQ API, so we can sidestep GROQ rate
 * limits. It is a drop-in `BaseChatModel`, so every existing call site
 * (`.invoke()`, `.stream()`, `.pipe()`, `.bindTools()`) works unchanged.
 *
 * How it talks to the CLI:
 *  - Non-streaming: `claude -p --output-format json`, prompt piped over stdin,
 *    answer read from the `.result` field.
 *  - Streaming:     `claude -p --output-format stream-json --include-partial-messages
 *    --verbose`, text emitted from `content_block_delta` / `text_delta` events.
 *
 * Tool calling: the CLI runs its own agent loop and can't hand tool calls back
 * to our in-process (userId-bound) MCP tools, so we implement a lightweight
 * prompt protocol — the tool schemas are injected into the prompt and the model
 * is asked to reply with `{"tool_calls":[{"name","args"}]}`. That output is
 * parsed into `AIMessage.tool_calls`, which the existing agent loop
 * (`answerWithTools`) executes exactly as it does for GROQ.
 *
 * Known limitations vs. an HTTP LLM (documented, intentional):
 *  - No `temperature` control (the CLI exposes none) — the option is ignored.
 *  - No native JSON response_format — JSON is requested via the prompt; the
 *    existing `llm-json` repair/extract layer already tolerates that.
 *  - Higher per-call latency (spawns a local process each call).
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
  type BaseChatModelParams,
  type BindToolsInput,
} from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
  type ToolMessage,
} from '@langchain/core/messages';
import { ChatGenerationChunk, type ChatResult } from '@langchain/core/outputs';
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { convertToOpenAITool } from '@langchain/core/utils/function_calling';
import { extractJsonBlock } from '../lib/llm-json.js';

export interface ChatClaudeCodeCallOptions extends BaseChatModelCallOptions {
  /** Tools made available to the model (populated by `bindTools`). */
  tools?: BindToolsInput[];
}

export interface ChatClaudeCodeParams extends BaseChatModelParams {
  /** Model id passed to `--model` (defaults to CLAUDE_CODE_MODEL, else the CLI default). */
  model?: string;
  /** Path to the `claude` binary (defaults to CLAUDE_CODE_PATH, else `claude`). */
  cliPath?: string;
  /** Hard timeout per CLI invocation in ms (default 120s). */
  timeoutMs?: number;
  /** Present for API parity with ChatGroq; the CLI has no temperature knob. */
  temperature?: number;
  streaming?: boolean;
  json?: boolean;
}

/** Flatten LangChain message content (string | parts[]) into plain text. */
function contentToString(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'string' ? part : ((part as { text?: string })?.text ?? '')
      )
      .join('');
  }
  return content ? JSON.stringify(content) : '';
}

/** Try to read a `{ tool_calls: [...] }` payload out of the model's text output. */
function tryParseToolCalls(
  text: string
): Array<{ name: string; args?: Record<string, unknown> }> | null {
  try {
    const obj = JSON.parse(extractJsonBlock(text)) as {
      tool_calls?: Array<{ name?: unknown; args?: unknown }>;
    };
    const calls = obj?.tool_calls;
    if (
      Array.isArray(calls) &&
      calls.length > 0 &&
      calls.every((c) => c && typeof c.name === 'string')
    ) {
      return calls.map((c) => ({
        name: c.name as string,
        args: (c.args as Record<string, unknown>) ?? {},
      }));
    }
  } catch {
    // Not a tool-call payload — treat as a plain-text answer.
  }
  return null;
}

export class ChatClaudeCode extends BaseChatModel<ChatClaudeCodeCallOptions> {
  model?: string;
  cliPath: string;
  timeoutMs: number;
  streaming: boolean;

  constructor(fields: ChatClaudeCodeParams = {}) {
    super(fields);
    this.model = fields.model ?? process.env.CLAUDE_CODE_MODEL ?? undefined;
    this.cliPath = fields.cliPath ?? process.env.CLAUDE_CODE_PATH ?? 'claude';
    this.timeoutMs = fields.timeoutMs ?? 120_000;
    this.streaming = fields.streaming ?? false;
  }

  _llmType(): string {
    return 'claude-code';
  }

  override bindTools(tools: BindToolsInput[], kwargs?: Partial<ChatClaudeCodeCallOptions>) {
    return this.withConfig({ tools, ...kwargs } as Partial<ChatClaudeCodeCallOptions>);
  }

  /**
   * Build the argv for one CLI invocation. The conversation goes via stdin; the
   * system prompt (our role + tool protocol) is passed as a *replacement* for
   * the CLI's default coding-agent prompt via `--system-prompt-file`, with
   * `--exclude-dynamic-system-prompt-sections` so the built-in agent framing
   * doesn't treat our instructions as injected content and refuse.
   */
  private buildArgs(stream: boolean, systemFile?: string): string[] {
    // `--tools ""` strips EVERY built-in tool from the CLI. This is a hard
    // safety requirement, not an optimization: the CLI is a full coding agent,
    // and meeting transcripts are untrusted input. Without this, a transcript
    // that *sounds* like instructions ("please fix these issues") can make the
    // spawned agent edit this repo, run git, or execute shell commands as the
    // backend user — which is exactly what a runaway session did on 17 Jul 2026
    // (rogue edits + a "fix issues" commit while summarizing a meeting).
    const args = ['-p', '--tools', '', '--output-format', stream ? 'stream-json' : 'json'];
    if (stream) args.push('--include-partial-messages', '--verbose');
    if (systemFile) {
      args.push('--system-prompt-file', systemFile, '--exclude-dynamic-system-prompt-sections');
    }
    if (this.model) args.push('--model', this.model);
    return args;
  }

  /** Write the system prompt to a temp file (empty → no file). Returns a cleanup fn. */
  private async writeSystemFile(
    system: string
  ): Promise<{ file?: string; cleanup: () => Promise<void> }> {
    if (!system) return { cleanup: async () => {} };
    const file = join(tmpdir(), `claude-sys-${randomUUID()}.txt`);
    await writeFile(file, system, 'utf8');
    return {
      file,
      cleanup: async () => {
        try {
          await unlink(file);
        } catch {
          // best-effort temp cleanup
        }
      },
    };
  }

  /** Instructions appended to the prompt describing the tool-call protocol. */
  private buildToolInstructions(tools: BindToolsInput[]): string {
    const specs = tools
      .map((t) => {
        try {
          return convertToOpenAITool(t as Parameters<typeof convertToOpenAITool>[0]).function;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return [
      '## Tool use (IMPORTANT)',
      'You CANNOT access any external system directly. The ONLY way to obtain live',
      "data (e.g. the user's calendar, email, or anything not already provided above)",
      'is to call one of these tools. Their JSON schemas:',
      JSON.stringify(specs, null, 2),
      '',
      'When a tool is relevant, you MUST reply with ONLY the following JSON object —',
      'no prose, no markdown, no apology, nothing before or after it:',
      '{"tool_calls": [{"name": "<tool name>", "args": { ...arguments... }}]}',
      'Do not answer from memory and do not say you are unable to help; call the tool.',
      'Only when you already have enough information to answer should you reply with',
      'the final answer as plain text (no JSON, no tool_calls).',
    ].join('\n');
  }

  /**
   * Render the message list into a system prompt + a stdin conversation string
   * (the CLI is stateless, so the full history is rebuilt each call).
   */
  private renderPrompt(
    messages: BaseMessage[],
    tools?: BindToolsInput[]
  ): { system: string; prompt: string } {
    const systemParts: string[] = [];
    const convoParts: string[] = [];

    for (const m of messages) {
      const type = m.getType();
      const content = contentToString(m.content);
      if (type === 'system') {
        if (content) systemParts.push(content);
      } else if (type === 'human') {
        convoParts.push(`User: ${content}`);
      } else if (type === 'ai') {
        const toolCalls = (m as AIMessage).tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          convoParts.push(
            `Assistant requested tool calls: ${JSON.stringify(
              toolCalls.map((c) => ({ name: c.name, args: c.args }))
            )}`
          );
        } else {
          convoParts.push(`Assistant: ${content}`);
        }
      } else if (type === 'tool' || type === 'function') {
        const id = (m as ToolMessage).tool_call_id;
        convoParts.push(`Tool result${id ? ` (${id})` : ''}: ${content}`);
      } else {
        convoParts.push(content);
      }
    }

    if (tools && tools.length > 0) {
      systemParts.push(this.buildToolInstructions(tools));
    }

    return {
      system: systemParts.join('\n\n'),
      // Ensure there is always a user turn for the CLI to respond to.
      prompt: convoParts.join('\n\n') || '(continue)',
    };
  }

  /** Run the CLI in JSON mode and return the `.result` text. */
  private async runOnce(system: string, prompt: string): Promise<string> {
    const { file, cleanup } = await this.writeSystemFile(system);
    try {
      return await this.runOnceSpawn(prompt, file);
    } finally {
      await cleanup();
    }
  }

  private runOnceSpawn(prompt: string, systemFile?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.cliPath, this.buildArgs(false, systemFile), {
        stdio: ['pipe', 'pipe', 'pipe'],
        // Never run inside the repo: keeps the CLI from loading this project's
        // CLAUDE.md / .claude settings (incl. permission allowlists) and, with
        // --tools "", is the second wall between untrusted transcript text and
        // this codebase.
        cwd: tmpdir(),
      });
      let out = '';
      let err = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`claude CLI timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      child.stdout.on('data', (d) => (out += d.toString()));
      child.stderr.on('data', (d) => (err += d.toString()));
      child.on('error', (e) => {
        clearTimeout(timer);
        reject(
          new Error(
            `Failed to spawn claude CLI ("${this.cliPath}"). Is Claude Code installed and on PATH? ${e.message}`
          )
        );
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`claude CLI exited with code ${code}: ${err || out}`));
          return;
        }
        try {
          const obj = JSON.parse(out.trim()) as {
            result?: string;
            is_error?: boolean;
            subtype?: string;
          };
          if (obj.is_error || (obj.subtype && obj.subtype !== 'success')) {
            reject(new Error(`claude CLI error: ${obj.result ?? obj.subtype}`));
            return;
          }
          if (typeof obj.result !== 'string') {
            reject(new Error('claude CLI returned no result text'));
            return;
          }
          resolve(obj.result);
        } catch (parseErr) {
          reject(
            new Error(
              `Failed to parse claude CLI output: ${
                parseErr instanceof Error ? parseErr.message : String(parseErr)
              }`
            )
          );
        }
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tools = options.tools;
    const { system, prompt } = this.renderPrompt(messages, tools);
    const resultText = await this.runOnce(system, prompt);

    // With tools bound, a tool-call payload becomes AIMessage.tool_calls so the
    // existing agent loop can execute them; otherwise it's the final answer.
    let message: AIMessage;
    if (tools && tools.length > 0) {
      const calls = tryParseToolCalls(resultText);
      if (!calls && process.env.CLAUDE_CODE_DEBUG) {
        console.error('[claude-code] tools bound but no tool_calls parsed. Raw:', resultText);
      }
      if (calls) {
        message = new AIMessage({
          content: '',
          tool_calls: calls.map((c) => ({
            name: c.name,
            args: c.args ?? {},
            id: randomUUID(),
            type: 'tool_call' as const,
          })),
        });
      } else {
        message = new AIMessage({ content: resultText });
      }
    } else {
      message = new AIMessage({ content: resultText });
    }

    await runManager?.handleLLMNewToken(typeof message.content === 'string' ? message.content : '');

    return {
      generations: [
        { text: typeof message.content === 'string' ? message.content : '', message },
      ],
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const { system, prompt } = this.renderPrompt(messages, options.tools);
    const { file: systemFile, cleanup } = await this.writeSystemFile(system);
    const child = spawn(this.cliPath, this.buildArgs(true, systemFile), {
      stdio: ['pipe', 'pipe', 'pipe'],
      // Same containment as runOnceSpawn: no repo cwd, no project settings.
      cwd: tmpdir(),
    });

    let stderr = '';
    let spawnError: Error | null = null;
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (e) => {
      spawnError = new Error(
        `Failed to spawn claude CLI ("${this.cliPath}"). Is Claude Code installed and on PATH? ${e.message}`
      );
    });
    const closed = new Promise<number>((resolve) => child.on('close', (code) => resolve(code ?? 0)));

    const timer = setTimeout(() => child.kill('SIGKILL'), this.timeoutMs);

    child.stdin.write(prompt);
    child.stdin.end();

    let sawText = false;
    let finalText = '';
    const rl = createInterface({ input: child.stdout });

    try {
      for await (const line of rl) {
        if (spawnError) throw spawnError;
        const trimmed = line.trim();
        if (!trimmed) continue;
        let evt: {
          type?: string;
          event?: { type?: string; delta?: { type?: string; text?: string } };
          result?: string;
          is_error?: boolean;
        };
        try {
          evt = JSON.parse(trimmed);
        } catch {
          continue; // ignore non-JSON lines
        }

        if (
          evt.type === 'stream_event' &&
          evt.event?.type === 'content_block_delta' &&
          evt.event.delta?.type === 'text_delta'
        ) {
          const text = evt.event.delta.text ?? '';
          if (text) {
            sawText = true;
            await runManager?.handleLLMNewToken(text);
            yield new ChatGenerationChunk({
              text,
              message: new AIMessageChunk({ content: text }),
            });
          }
        } else if (evt.type === 'result') {
          finalText = evt.result ?? finalText;
          if (evt.is_error) throw new Error(`claude CLI error: ${evt.result}`);
        }
      }
    } finally {
      clearTimeout(timer);
      await cleanup();
    }

    const code = await closed;
    if (spawnError) throw spawnError;
    if (code !== 0 && !sawText) {
      throw new Error(`claude CLI exited with code ${code}: ${stderr}`);
    }

    // Fallback: the CLI didn't emit incremental deltas but produced a final
    // result — surface it as a single chunk so streaming callers still work.
    if (!sawText && finalText) {
      yield new ChatGenerationChunk({
        text: finalText,
        message: new AIMessageChunk({ content: finalText }),
      });
    }
  }
}
