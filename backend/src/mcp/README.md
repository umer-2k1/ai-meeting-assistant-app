# MCP tools

This folder has two layers:

1. **`tools/`** — the actual tool implementations (`calendar-tools.ts`, `gmail-tools.ts`) and the `mcpToolRegistry` (`tools/index.ts`) that lists, executes, and exposes them as LangChain-compatible schemas.
2. **`server.ts`** — a standalone [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the same tools over stdio, for *external* MCP clients (Claude Desktop, Cursor, etc.).

These two layers share one source of truth (`mcpToolRegistry`), but are used differently:

- The **in-app AI chat** ("Ask Meeting AI") calls `mcpToolRegistry` directly in-process via `backend/src/services/ai-agent.ts`. No extra process, no auth complications — the authenticated request's `userId` is used directly.
- The **standalone MCP server** (`server.ts`) is for people who want to ask Claude Desktop / Cursor things like "what's on my calendar today" using this app's Google connection, outside of the web app entirely.

## Running the standalone server locally

```bash
cd backend
pnpm mcp:server
```

### Known limitation: single user per process

A stdio MCP session has no per-request auth header, so there's no way to know "which app user is asking" the way the HTTP API does with a JWT. For this first pass, the server resolves **one fixed user** for its whole lifetime via the `MCP_USER_ID` environment variable.

1. Find your user id:
   ```bash
   pnpm db:studio
   # Open the User table, copy the `id` column for your account
   ```
2. Set `MCP_USER_ID` when the client launches the server (see configs below).

If `MCP_USER_ID` is missing, the server logs an error and exits immediately.

## Connecting from Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ai-meeting-copilot": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/ai-meeting-assistant-app/backend", "mcp:server"],
      "env": {
        "MCP_USER_ID": "your-user-id-here"
      }
    }
  }
}
```

## Connecting from Cursor

Add to your Cursor MCP config (Settings -> MCP):

```json
{
  "mcpServers": {
    "ai-meeting-copilot": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/ai-meeting-assistant-app/backend", "mcp:server"],
      "env": {
        "MCP_USER_ID": "your-user-id-here"
      }
    }
  }
}
```

## Available tools

| Tool | What it does |
|---|---|
| `list_upcoming_meetings` | List upcoming Google Calendar events |
| `get_meeting_details` | Get full details of a specific event |
| `create_meeting` | Create a new Google Calendar event |
| `send_followup_email` | Send a follow-up email via Gmail |
| `draft_email` | Create a Gmail draft (not sent) |
| `search_related_emails` | Search Gmail for messages matching a query |

All of these require the corresponding Google integration (Calendar / Gmail) to be connected for `MCP_USER_ID` in the app's Settings -> Integrations first — otherwise each tool call returns a "not found or inactive" error.
