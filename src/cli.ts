import { runOrchestrator } from './orchestrator.js';
import { TaskInput } from './core/types.js';
import { llmGenerate } from './tools/llm-tool.js';

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
  pipeline?: string;
  searchProvider?: string;
  searchMaxResults?: number;
  searchTimeoutMs?: number;
  searchConfigPath?: string;
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
  pipeline: options.pipeline,
  searchProvider: options['search-provider'],
  searchMaxResults: parseNumber(options['search-max-results']),
  searchTimeoutMs: parseNumber(options['search-timeout-ms']),
  searchConfigPath: options['search-config'],
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
  if (overrides.pipeline) {
    payload.pipeline = overrides.pipeline;
  }
  if (overrides.searchProvider) {
    payload.searchProvider = overrides.searchProvider;
  }
  if (overrides.searchMaxResults !== undefined) {
    payload.searchMaxResults = overrides.searchMaxResults;
  }
  if (overrides.searchTimeoutMs !== undefined) {
    payload.searchTimeoutMs = overrides.searchTimeoutMs;
  }
  if (overrides.searchConfigPath) {
    payload.searchConfigPath = overrides.searchConfigPath;
  }

  return {
    id: 'task-adhoc',
    summary:
      overrides.summary ??
      (overrides.topic ? `Research ${overrides.topic}` : 'Run an ad-hoc task'),
    payload,
  };
};

const buildSearchOverrides = (queryText: string, base: CliOverrides): CliOverrides => {
  const trimmed = queryText.trim();
  return {
    ...base,
    summary: base.summary ?? `Search ${trimmed}`,
    topic: base.topic ?? trimmed,
    query: base.query ?? trimmed,
    prompt:
      base.prompt ??
      `请基于检索结果总结“${trimmed}”的核心观点、应用场景与关键参考。`,
  };
};

const buildPipelineTasks = (topic: string, overrides: CliOverrides): TaskInput[] => {
  const pipeline = overrides.pipeline ?? 'triad';
  const safeTopic = topic.trim();
  const root = overrides.root ?? '.';
  const url = overrides.url;
  const extensions = overrides.extensions ?? ['.md', '.txt', '.ts'];
  const userPrompt = overrides.prompt?.trim();
  const sharedPayload: Record<string, unknown> = {
    topic: overrides.topic ?? safeTopic,
    priority: overrides.priority ?? 'high',
    root,
    query: overrides.query ?? safeTopic,
    extensions,
  };

  if (overrides.searchProvider) {
    sharedPayload.searchProvider = overrides.searchProvider;
  }
  if (overrides.searchMaxResults !== undefined) {
    sharedPayload.searchMaxResults = overrides.searchMaxResults;
  }
  if (overrides.searchTimeoutMs !== undefined) {
    sharedPayload.searchTimeoutMs = overrides.searchTimeoutMs;
  }
  if (overrides.searchConfigPath) {
    sharedPayload.searchConfigPath = overrides.searchConfigPath;
  }

  const pipelineTools: Record<string, string[]> = {
    triad: ['checklist', 'summarize', 'web_search', 'http_get', 'file_search'],
    quick: ['summarize', 'web_search', 'file_search'],
    deep: ['checklist', 'web_search', 'http_get', 'file_search', 'llm_generate'],
  };

  const toolIds = pipelineTools[pipeline] ?? pipelineTools.triad;

  return [
    {
      id: 'task-intake',
      summary: `Clarify request for ${safeTopic}`,
      payload: {
        ...sharedPayload,
        toolIds: ['checklist', 'summarize'],
        prompt: userPrompt
          ? `用户需求：${userPrompt}\n请梳理“${safeTopic}”的关键问题与信息需求。`
          : `请梳理“${safeTopic}”的关键问题与信息需求。`,
      },
    },
    {
      id: 'task-run',
      summary: `Collect sources for ${safeTopic}`,
      payload: {
        ...sharedPayload,
        toolIds,
        url,
        prompt: userPrompt
          ? `用户需求：${userPrompt}\n请基于检索结果总结“${safeTopic}”的核心观点、应用场景与关键参考。`
          : `请基于检索结果总结“${safeTopic}”的核心观点、应用场景与关键参考。`,
      },
    },
    {
      id: 'task-wrap',
      summary: `Summarize outcome for ${safeTopic}`,
      payload: {
        ...sharedPayload,
        toolIds: ['llm_generate', 'summarize'],
        prompt: userPrompt
          ? `用户需求：${userPrompt}\n请给出“${safeTopic}”的最终答复与建议。`
          : `请给出“${safeTopic}”的要点总结与下一步建议。`,
      },
    },
  ];
};

const isSearchCommand = (value?: string) =>
  value === 'search' || value === 'ask' || value === 'query';

const isFlowCommand = (value?: string) => value === 'flow' || value === 'pipeline';

const isChatCommand = (value?: string) => value === 'chat' || value === 'talk' || value === 'say';

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
  npm run dev -- search <query> [options]
  npm run dev -- flow <topic> [options]
  npm run dev -- chat <message> [options]

Shortcuts:
  npm run mao -- search <query> [options]
  npm run search -- <query> [options]
  npm run flow -- <topic> [options]
  npm run chat -- <message> [options]

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
  --pipeline <triad|quick|deep>
  --search-provider <tavily|serpapi>
  --search-max-results <number>
  --search-timeout-ms <number>
  --search-config <path>
  --help

Example:
  npm run dev -- search "Vision Transformer" --url "https://arxiv.org/abs/2010.11929" --root "D:\\papers" --extensions ".md,.txt"
  npm run dev -- flow "Vision Transformer" --url "https://arxiv.org/abs/2010.11929" --root "D:\\papers" --pipeline deep
  npm run dev -- chat "我想搜索相关DIT的内容"
  npm run dev -- --summary "Vision Transformer" --topic "Vision Transformer" --url "https://arxiv.org/abs/2010.11929" --root "D:\\papers" --query "vision transformer" --extensions ".md,.txt" --prompt "请总结核心思想"
`);
};

const extractQueryFromMessage = async (message: string) => {
  const prompt = [
    'You are a query extractor.',
    'Given a user request in Chinese, return a short search query only.',
    'If the request already contains a topic, use it as the query.',
    'Return JSON only in the format: {"query":"...","topic":"..."}',
    `User request: ${message}`,
  ].join('\n');

  try {
    const response = await llmGenerate(prompt);
    const start = response.indexOf('{');
    const end = response.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    const parsed = JSON.parse(response.slice(start, end + 1)) as {
      query?: string;
      topic?: string;
    };
    const query = parsed.query?.trim();
    const topic = parsed.topic?.trim();
    if (!query && !topic) {
      return null;
    }
    return { query: query ?? topic ?? message, topic: topic ?? query ?? message };
  } catch {
    return null;
  }
};

const main = async () => {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.options.help === 'true' || parsed.options.h === 'true') {
    printHelp();
    process.exit(0);
  }

  const overrides = buildOverrides(parsed.options);
  const firstPositional = parsed.positionals[0];
  const isCommand =
    isSearchCommand(firstPositional) ||
    isFlowCommand(firstPositional) ||
    isChatCommand(firstPositional);
  const configPath =
    parsed.options.config ?? (isCommand ? 'examples/agent-config.yaml' : firstPositional) ??
    'examples/agent-config.yaml';

  let tasks: TaskInput[] = [];

  if (isCommand) {
    const commandArg = parsed.positionals.slice(1).join(' ').trim();
    if (!commandArg) {
      printHelp();
      process.exit(1);
    }
    if (isSearchCommand(firstPositional)) {
      const merged = buildSearchOverrides(commandArg, overrides);
      tasks = [buildTaskFromOverrides(merged)];
    } else if (isFlowCommand(firstPositional)) {
      tasks = buildPipelineTasks(commandArg, overrides);
    } else if (isChatCommand(firstPositional)) {
      const extracted = await extractQueryFromMessage(commandArg);
      const topic = extracted?.topic ?? commandArg;
      const chatOverrides: CliOverrides = {
        ...overrides,
        topic: overrides.topic ?? topic,
        query: overrides.query ?? extracted?.query ?? topic,
        prompt: overrides.prompt ?? commandArg,
        pipeline: overrides.pipeline ?? 'deep',
      };
      tasks = buildPipelineTasks(topic, chatOverrides);
    } else {
      tasks = [buildTaskFromOverrides(overrides)];
    }
  } else if (hasOverrides(overrides)) {
    tasks = [buildTaskFromOverrides(overrides)];
  } else {
    tasks = defaultTasks;
  }

  const { results } = await runOrchestrator(configPath, tasks);
  for (const result of results) {
    // eslint-disable-next-line no-console
    console.log(`\n[${result.agentId}] ${result.output}`);
  }
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Execution failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
