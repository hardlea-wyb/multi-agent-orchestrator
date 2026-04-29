import { runOrchestrator } from './orchestrator.js';
import { TaskInput } from './core/types.js';

type ParsedArgs = {
  options: Record<string, string>;
  positionals: string[];
};

type CliOverrides = {
  summary?: string;
  topic?: string;
  priority?: string;
  url?: string;
  root?: string;
  query?: string;
  extensions?: string[];
  prompt?: string;
  filenameIncludes?: string;
  maxResults?: number;
  maxFileSizeKb?: number;
  httpTimeoutMs?: number;
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const options: Record<string, string> = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, valueFromEq] = arg.slice(2).split('=', 2);
      if (!key) {
        continue;
      }
      if (valueFromEq !== undefined) {
        options[key] = valueFromEq;
        continue;
      }
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i += 1;
      } else {
        options[key] = 'true';
      }
    } else {
      positionals.push(arg);
    }
  }

  return { options, positionals };
};

const parseNumber = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const parseList = (value?: string) => {
  if (!value) {
    return undefined;
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildOverrides = (options: Record<string, string>): CliOverrides => ({
  summary: options.summary,
  topic: options.topic,
  priority: options.priority,
  url: options.url,
  root: options.root,
  query: options.query,
  extensions: parseList(options.extensions),
  prompt: options.prompt,
  filenameIncludes: options['filename-includes'],
  maxResults: parseNumber(options['max-results']),
  maxFileSizeKb: parseNumber(options['max-file-size-kb']),
  httpTimeoutMs: parseNumber(options['http-timeout-ms']),
});

const hasOverrides = (overrides: CliOverrides) =>
  Object.values(overrides).some((value) => value !== undefined);

const buildTaskFromOverrides = (overrides: CliOverrides): TaskInput => {
  const payload: Record<string, unknown> = {};

  if (overrides.topic) {
    payload.topic = overrides.topic;
  }
  if (overrides.priority) {
    payload.priority = overrides.priority;
  }
  if (overrides.url) {
    payload.url = overrides.url;
  }
  if (overrides.root) {
    payload.root = overrides.root;
  }
  if (overrides.query) {
    payload.query = overrides.query;
  }
  if (overrides.extensions?.length) {
    payload.extensions = overrides.extensions;
  }
  if (overrides.prompt) {
    payload.prompt = overrides.prompt;
  }
  if (overrides.filenameIncludes) {
    payload.filenameIncludes = overrides.filenameIncludes;
  }
  if (overrides.maxResults !== undefined) {
    payload.maxResults = overrides.maxResults;
  }
  if (overrides.maxFileSizeKb !== undefined) {
    payload.maxFileSizeKb = overrides.maxFileSizeKb;
  }
  if (overrides.httpTimeoutMs !== undefined) {
    payload.timeoutMs = overrides.httpTimeoutMs;
  }

  return {
    id: 'task-adhoc',
    summary:
      overrides.summary ??
      (overrides.topic ? `Research ${overrides.topic}` : 'Run an ad-hoc task'),
    payload,
  };
};

const defaultTasks: TaskInput[] = [
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

const printHelp = () => {
  // eslint-disable-next-line no-console
  console.log(`Usage:
  npm run dev -- [configPath] [options]

Options:
  --config <path>
  --summary <text>
  --topic <text>
  --priority <text>
  --url <url>
  --root <path>
  --query <text>
  --extensions ".md,.txt"
  --filename-includes <text>
  --prompt <text>
  --max-results <number>
  --max-file-size-kb <number>
  --http-timeout-ms <number>
  --help

Example:
  npm run dev -- --summary "Vision Transformer" --topic "Vision Transformer" --url "https://arxiv.org/abs/2010.11929" --root "D:\\papers" --query "vision transformer" --extensions ".md,.txt" --prompt "请总结核心思想"
`);
};

const parsed = parseArgs(process.argv.slice(2));
if (parsed.options.help === 'true' || parsed.options.h === 'true') {
  printHelp();
  process.exit(0);
}

const configPath =
  parsed.options.config ?? parsed.positionals[0] ?? 'examples/agent-config.yaml';
const overrides = buildOverrides(parsed.options);
const tasks = hasOverrides(overrides) ? [buildTaskFromOverrides(overrides)] : defaultTasks;

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
