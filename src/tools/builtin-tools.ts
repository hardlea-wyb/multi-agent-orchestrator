import { ToolRegistry } from '../core/tool-registry.js';

export function registerBuiltinTools(registry: ToolRegistry) {
  registry.register({
    id: 'summarize',
    description: 'Summarize task payload in a short sentence.',
    handler: (input) => {
      const task = input.task as { summary?: string; payload?: Record<string, unknown> };
      const keys = task?.payload ? Object.keys(task.payload) : [];
      return `Summary: ${task?.summary ?? 'task'} | payload keys: ${keys.join(', ') || 'none'}`;
    },
  });

  registry.register({
    id: 'checklist',
    description: 'Generate a quick checklist for the task.',
    handler: (input) => {
      const task = input.task as { summary?: string };
      return `Checklist: understand scope, identify inputs, produce output for ${task?.summary ?? 'task'}`;
    },
  });
}
