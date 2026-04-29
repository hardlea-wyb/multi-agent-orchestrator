import { AgentRole, TaskInput, TaskResult } from '../core/types.js';
import { ToolRegistry } from '../core/tool-registry.js';
import { ExecutionTrace } from '../core/tracing.js';

export async function runSimpleAgent(
  task: TaskInput,
  agent: AgentRole,
  tools: ToolRegistry,
  trace: ExecutionTrace,
): Promise<TaskResult> {
  const toolIds = Array.isArray(task.payload?.toolIds)
    ? (task.payload.toolIds as string[])
    : agent.tools;
  const toolOutputs: string[] = [];

  for (const toolId of toolIds) {
    const tool = tools.get(toolId);
    if (!tool) {
      trace.record({
        timestamp: new Date().toISOString(),
        taskId: task.id,
        agentId: agent.id,
        status: 'failed',
        message: `Tool missing: ${toolId}`,
      });
      continue;
    }
    const output = await tool.handler({ task });
    toolOutputs.push(`[${toolId}] ${output}`);
  }

  return {
    taskId: task.id,
    agentId: agent.id,
    output: [
      `Agent ${agent.name} completed task: ${task.summary}`,
      `Goal: ${agent.goal}`,
      `Tools used: ${toolOutputs.length > 0 ? toolOutputs.join(' | ') : 'none'}`,
    ].join('\n'),
    metadata: {
      toolCount: toolOutputs.length,
    },
  };
}
