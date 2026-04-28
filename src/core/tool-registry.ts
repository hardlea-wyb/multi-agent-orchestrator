export type ToolHandler = (input: Record<string, unknown>) => Promise<string> | string;

export type ToolDefinition = {
  id: string;
  description: string;
  handler: ToolHandler;
};

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition) {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool already registered: ${tool.id}`);
    }
    this.tools.set(tool.id, tool);
  }

  get(id: string) {
    return this.tools.get(id) ?? null;
  }

  list() {
    return [...this.tools.values()];
  }
}
