import { runOrchestrator } from './orchestrator.js';
import { TaskInput } from './core/types.js';

const args = process.argv.slice(2);
const configPath = args[0] ?? 'examples/agent-config.yaml';

const tasks: TaskInput[] = [
  {
    id: 'task-brief',
    summary: 'Analyze requirements for a new agent workflow',
    payload: {
      topic: 'Multi-agent orchestration',
      priority: 'high',
      url: 'https://example.com',
      root: '.',
      query: 'orchestrator',
      extensions: ['.ts', '.md'],
      prompt: '请基于当前任务给出简短建议。',
    },
  },
  {
    id: 'task-search',
    summary: 'Identify modules needed for orchestration',
    payload: {
      modules: ['dispatcher', 'config', 'tools', 'tracing'],
    },
  },
  {
    id: 'task-summarize',
    summary: 'Summarize outcome for stakeholders',
    payload: {
      audience: 'engineering leadership',
    },
  },
];

runOrchestrator(configPath, tasks)
  .then(({ results }) => {
    for (const result of results) {
      // eslint-disable-next-line no-console
      console.log(`\n[${result.agentId}] ${result.output}`);
    }
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Execution failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
