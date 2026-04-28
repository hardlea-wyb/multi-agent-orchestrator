import { logger } from './logger.js';
import { ExecutionTrace } from './tracing.js';
import { AgentRole, TaskInput, TaskResult } from './types.js';
import { ToolRegistry } from './tool-registry.js';

export type TaskHandler = (
  task: TaskInput,
  agent: AgentRole,
  tools: ToolRegistry,
  trace: ExecutionTrace,
) => Promise<TaskResult>;

export class TaskDispatcher {
  private concurrency: number;
  private retryAttempts: number;
  private retryBackoffMs: number;
  private trace: ExecutionTrace;

  constructor(options: { concurrency: number; retryAttempts: number; retryBackoffMs: number }) {
    this.concurrency = options.concurrency;
    this.retryAttempts = options.retryAttempts;
    this.retryBackoffMs = options.retryBackoffMs;
    this.trace = new ExecutionTrace();
  }

  getTrace() {
    return this.trace;
  }

  async run(
    tasks: TaskInput[],
    agents: AgentRole[],
    tools: ToolRegistry,
    handler: TaskHandler,
  ): Promise<TaskResult[]> {
    const queue = [...tasks];
    const results: TaskResult[] = [];
    const active: Promise<void>[] = [];

    const runTask = async (task: TaskInput, agent: AgentRole) => {
      let attempt = 0;
      while (attempt <= this.retryAttempts) {
        attempt += 1;
        this.trace.record({
          timestamp: new Date().toISOString(),
          taskId: task.id,
          agentId: agent.id,
          status: 'running',
          message: `Attempt ${attempt} started`,
        });
        try {
          const result = await handler(task, agent, tools, this.trace);
          results.push(result);
          this.trace.record({
            timestamp: new Date().toISOString(),
            taskId: task.id,
            agentId: agent.id,
            status: 'succeeded',
            message: 'Task completed',
          });
          return;
        } catch (error) {
          logger.warn({ err: error, taskId: task.id, agentId: agent.id }, 'Task failed');
          this.trace.record({
            timestamp: new Date().toISOString(),
            taskId: task.id,
            agentId: agent.id,
            status: 'failed',
            message: `Attempt ${attempt} failed`,
            detail: { error: error instanceof Error ? error.message : String(error) },
          });
          if (attempt > this.retryAttempts) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, this.retryBackoffMs));
        }
      }
    };

    const pickAgent = (index: number) => agents[index % agents.length];

    const startNext = () => {
      const task = queue.shift();
      if (!task) {
        return null;
      }
      const agent = pickAgent(results.length + queue.length);
      const promise = runTask(task, agent).finally(() => {
        active.splice(active.indexOf(promise), 1);
      });
      active.push(promise);
      return promise;
    };

    while (queue.length > 0 || active.length > 0) {
      while (queue.length > 0 && active.length < this.concurrency) {
        startNext();
      }
      if (active.length > 0) {
        await Promise.race(active);
      }
    }

    return results;
  }
}
