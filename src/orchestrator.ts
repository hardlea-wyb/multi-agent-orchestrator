import { loadConfig } from './core/config.js';
import { TaskDispatcher } from './core/dispatcher.js';
import { ToolRegistry } from './core/tool-registry.js';
import { logger } from './core/logger.js';
import { runSimpleAgent } from './agents/simple-agent.js';
import { registerBuiltinTools } from './tools/builtin-tools.js';
import { TaskInput } from './core/types.js';

export async function runOrchestrator(configPath: string, tasks: TaskInput[]) {
  const config = await loadConfig(configPath);
  const registry = new ToolRegistry();
  registerBuiltinTools(registry);

  const dispatcher = new TaskDispatcher({
    concurrency: config.maxConcurrency,
    retryAttempts: config.retry.attempts,
    retryBackoffMs: config.retry.backoffMs,
  });

  const results = await dispatcher.run(tasks, config.agents, registry, runSimpleAgent);
  const trace = dispatcher.getTrace().summary();

  logger.info({ project: config.project, summary: trace }, 'Run completed');

  return { results, trace };
}
