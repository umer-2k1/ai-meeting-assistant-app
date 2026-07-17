# Using Claude Code as the LLM provider

The backend can run all its LLM work (summaries, action items, titles/tags, Q&A,
the streaming chat, and the Calendar/Gmail agent) through **either**:

- **GROQ** (default) — the GROQ API, requires `GROQ_API_KEY`.
- **Claude Code** — your local `claude` CLI **subscription**, no API key.

Switch with a single env var: `LLM_PROVIDER`. Use `claude-code` when GROQ is
rate‑limited and you're running the backend on your own machine.

> **Important:** `claude-code` only works where the backend process runs on a
> machine that has Claude Code installed *and logged in*. It shells out to the
> local `claude` binary, so it is **not** suitable for a headless/shared
> production deployment. Keep the default (`groq`) for hosted environments.

---

## Step‑by‑step

### 1. Install and log in to Claude Code

```bash
# Install (if you haven't already)
npm install -g @anthropic-ai/claude-code

# Verify it's on your PATH
claude --version        # e.g. 2.1.201 (Claude Code)

# Log in with your subscription (opens a browser)
claude          # then run /login inside the session, or:
claude /login
```

Confirm print mode works and uses your subscription (no API key):

```bash
claude -p "Reply with just: pong" --output-format json
# -> {"type":"result","result":"pong","is_error":false, ...}
```

### 2. Point the backend at Claude Code

In `backend/.env` (copy from `backend/.env.example` if you haven't):

```bash
LLM_PROVIDER=claude-code
# GROQ_API_KEY is no longer required in this mode.

# Optional:
# CLAUDE_CODE_MODEL=claude-opus-4-8   # override the model (defaults to the CLI's)
# CLAUDE_CODE_PATH=claude             # absolute path to the binary if not on PATH
```

### 3. Start the backend as usual

```bash
cd backend
npm run dev
```

On boot, `validate-env` **no longer requires `GROQ_API_KEY`** when
`LLM_PROVIDER=claude-code`, so the server starts without it.

### 4. Use the app normally

Every AI feature now runs through the local `claude` CLI:

| Feature | Where |
| --- | --- |
| Meeting summary, action items, title/tags | post‑meeting processing |
| Pre‑meeting brief | intelligence |
| Ask‑Meeting Q&A (streaming) | live copilot panel |
| Calendar / Gmail agent | "Ask Meeting AI" with tools |

### 5. Switch back to GROQ

Set `LLM_PROVIDER=groq` (or remove the line) and restart. Behaviour is identical
to before this feature existed.

---

## How it works

- `backend/src/services/llm-provider.ts` — `createLLM()` reads `LLM_PROVIDER` and
  returns either `ChatGroq` or `ChatClaudeCode`. Every service builds its model
  through this one factory.
- `backend/src/models/chat-claude-code.ts` — a LangChain `BaseChatModel` that
  wraps the CLI:
  - non‑streaming → `claude -p --output-format json` (answer read from `.result`)
  - streaming → `claude -p --output-format stream-json --include-partial-messages`
  - tool calling → our role + tool schemas are passed as a **replacement**
    system prompt (`--system-prompt-file --exclude-dynamic-system-prompt-sections`)
    so the CLI's built-in coding-agent prompt doesn't treat them as injected
    content. The model replies with `{"tool_calls":[…]}`, which is parsed into
    `AIMessage.tool_calls` and executed by the existing agent loop; results are
    fed back and the loop repeats until a final answer. This is a prompt-based
    protocol, not native function calling, so it is inherently less robust than
    GROQ's — the agent loop handles malformed/unknown-tool output gracefully, and
    `CLAUDE_CODE_DEBUG=1` logs any output that couldn't be parsed as a tool call.

## Trade‑offs & limitations

- **Latency:** each call spawns a local `claude` process, so responses are
  slower than a hosted API (seconds, not sub‑second).
- **No temperature control:** the CLI exposes none; the option is ignored.
- **No native JSON mode:** JSON is requested via the prompt. The existing
  `llm-json` repair/extract layer already tolerates minor deviations.
- **Local only:** requires an interactive, logged‑in Claude Code install on the
  same machine as the backend.

## Troubleshooting

- **`Failed to spawn claude CLI`** — `claude` isn't on the backend's PATH. Set
  `CLAUDE_CODE_PATH` to its absolute path (`which claude`).
- **`claude CLI error` / auth prompts** — run `claude` once interactively and
  `/login` to refresh your subscription session.
- **Agent isn't calling Calendar/Gmail tools** — set `CLAUDE_CODE_DEBUG=1` to log
  the raw model output; the wrapper prints what it received when a tool‑call
  payload can't be parsed.
