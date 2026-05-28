/**
 * MCP Tool Registry
 * 
 * Registers and manages all MCP tools available to the AI
 */

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
