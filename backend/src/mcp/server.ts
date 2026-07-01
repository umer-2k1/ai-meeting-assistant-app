/**
 * Standalone MCP (Model Context Protocol) server.
 *
 * Exposes this app's Calendar + Gmail tools to *external* MCP clients such
 * as Claude Desktop or Cursor, over the stdio transport. This is separate
 * from the in-app AI chat (backend/src/services/ai-agent.ts), which calls
 * the same tool registry directly in-process — no extra server needed there.
 *
 * Run it with:
 *   pnpm mcp:server
 *
 * Limitation: unlike the HTTP API, a stdio MCP session has no per-request
 * auth header to resolve "which app user is this?". For this first pass we
 * resolve a single user for the whole process via the MCP_USER_ID env var.
 * Find a user id via `pnpm db:studio` (User table -> id column) and set
 * MCP_USER_ID in your MCP client's server config (see mcp/README.md).
 */

import '../load-env.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mcpToolRegistry, buildZodSchemaFromParameters } from './tools/index.js';

async function main() {
  const userId = process.env.MCP_USER_ID;

  if (!userId) {
    console.error(
      '[mcp-server] MCP_USER_ID is not set.\n' +
        '[mcp-server] This server needs to know which app user to act as.\n' +
        '[mcp-server] Find a user id with `pnpm db:studio` (User table), then set\n' +
        '[mcp-server] MCP_USER_ID=<id> in your MCP client config (see backend/src/mcp/README.md).'
    );
    process.exit(1);
  }

  const server = new McpServer({
    name: 'ai-meeting-copilot',
    version: '1.0.0',
  });

  for (const mcpTool of mcpToolRegistry.getAllTools()) {
    server.registerTool(
      mcpTool.name,
      {
        description: mcpTool.description,
        inputSchema: buildZodSchemaFromParameters(mcpTool.parameters).shape,
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await mcpToolRegistry.executeTool(mcpTool.name, userId, args);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: error instanceof Error ? error.message : 'Tool execution failed',
              },
            ],
          };
        }
      }
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `[mcp-server] AI Meeting Copilot MCP server running on stdio (user: ${userId}, tools: ${mcpToolRegistry
      .getAllTools()
      .map((t) => t.name)
      .join(', ')})`
  );
}

main().catch((error) => {
  console.error('[mcp-server] Fatal error:', error);
  process.exit(1);
});
