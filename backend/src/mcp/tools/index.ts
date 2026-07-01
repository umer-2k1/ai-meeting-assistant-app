/**
 * MCP Tool Registry
 * 
 * Registers and manages all MCP tools available to the AI
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { calendarTools } from './calendar-tools.js';
import { gmailTools } from './gmail-tools.js';
import type { McpTool } from './calendar-tools.js';

/**
 * Registry of all available MCP tools
 */
class McpToolRegistry {
  private tools: Map<string, McpTool> = new Map();
  
  constructor() {
    this.registerTools();
  }
  
  /**
   * Register all tools
   */
  private registerTools() {
    // Register calendar tools
    for (const tool of calendarTools) {
      this.tools.set(tool.name, tool);
    }
    
    // Register Gmail tools
    for (const tool of gmailTools) {
      this.tools.set(tool.name, tool);
    }
  }
  
  /**
   * Get all registered tools
   */
  getAllTools(): McpTool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Get tool by name
   */
  getTool(name: string): McpTool | undefined {
    return this.tools.get(name);
  }
  
  /**
   * Execute a tool
   */
  async executeTool(
    toolName: string,
    userId: string,
    params: Record<string, any>
  ): Promise<any> {
    const tool = this.getTool(toolName);
    
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found`);
    }
    
    try {
      return await tool.execute(userId, params);
    } catch (error) {
      console.error(`Error executing tool "${toolName}":`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tool: toolName,
      };
    }
  }
  
  /**
   * Get tool definitions for LLM context
   */
  getToolDefinitions(): Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }> {
    return this.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Get all tools as LangChain StructuredTools, bound to a specific user.
   *
   * Binding `userId` in a closure (rather than exposing it as a tool parameter)
   * means the LLM never sees or controls whose calendar/inbox it's touching —
   * that's decided server-side by whoever is authenticated for this request.
   */
  getLangChainTools(userId: string): StructuredToolInterface[] {
    return this.getAllTools().map((mcpTool) =>
      tool(
        async (input: Record<string, unknown>) => {
          const result = await this.executeTool(mcpTool.name, userId, input);
          return JSON.stringify(result);
        },
        {
          name: mcpTool.name,
          description: mcpTool.description,
          schema: buildZodSchemaFromParameters(mcpTool.parameters),
        }
      )
    );
  }
}

/**
 * Convert an McpTool's plain parameter map into a zod object schema so it can
 * be used as a LangChain / Groq function-calling tool schema, or (via its
 * `.shape`) as a raw-shape input schema for the standalone MCP server in
 * mcp/server.ts.
 */
export function buildZodSchemaFromParameters(parameters: McpTool['parameters']): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [name, param] of Object.entries(parameters)) {
    let fieldSchema: z.ZodTypeAny;

    switch (param.type) {
      case 'number':
        fieldSchema = z.number();
        break;
      case 'boolean':
        fieldSchema = z.boolean();
        break;
      case 'array':
        fieldSchema = z.array(z.string());
        break;
      default:
        fieldSchema = z.string();
    }

    fieldSchema = fieldSchema.describe(param.description);
    shape[name] = param.required ? fieldSchema : fieldSchema.optional();
  }

  return z.object(shape);
}

// Export singleton instance
export const mcpToolRegistry = new McpToolRegistry();

/**
 * Get tool definitions formatted for LLM system prompt
 */
export function getToolDefinitionsForLLM(): string {
  const definitions = mcpToolRegistry.getToolDefinitions();
  
  return `
You have access to the following tools to help the user:

${definitions.map(tool => `
**${tool.name}**
${tool.description}

Parameters:
${Object.entries(tool.parameters).map(([name, param]) => 
  `- ${name} (${param.type})${param.required ? ' [REQUIRED]' : ''}: ${param.description}`
).join('\n')}
`).join('\n')}

To use a tool, respond with a JSON object in this format:
{
  "tool": "tool_name",
  "parameters": { ... }
}
`.trim();
}
