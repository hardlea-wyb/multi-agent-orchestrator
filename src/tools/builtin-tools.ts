import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ToolRegistry } from '../core/tool-registry.js';
import { llmGenerate } from './llm-tool.js';

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

  registry.register({
    id: 'http_get',
    description: 'Fetch a URL provided in task.payload.url and return status + snippet.',
    handler: async (input) => {
      const task = input.task as { payload?: Record<string, unknown> };
      const url = typeof task?.payload?.url === 'string' ? task.payload.url : null;
      if (!url) {
        return 'http_get skipped: payload.url missing';
      }

      const timeoutMs =
        typeof task.payload?.timeoutMs === 'number' ? task.payload.timeoutMs : 5000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, { signal: controller.signal });
        const text = await response.text();
        const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 200);
        return `GET ${url} -> ${response.status} ${response.statusText} | ${snippet || 'empty'}`;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `GET ${url} failed: ${message}`;
      } finally {
        clearTimeout(timer);
      }
    },
  });

  registry.register({
    id: 'file_search',
    description: 'Search local files for a query under payload.root.',
    handler: async (input) => {
      const task = input.task as { payload?: Record<string, unknown> };
      const payload = task?.payload ?? {};
      const root = typeof payload.root === 'string' ? payload.root : '.';
      const query = typeof payload.query === 'string' ? payload.query : null;
      const filenameIncludes =
        typeof payload.filenameIncludes === 'string' ? payload.filenameIncludes : null;
      const extensions = Array.isArray(payload.extensions)
        ? payload.extensions.filter((ext): ext is string => typeof ext === 'string')
        : [];
      const maxResults = typeof payload.maxResults === 'number' ? payload.maxResults : 8;
      const maxFileSizeKb =
        typeof payload.maxFileSizeKb === 'number' ? payload.maxFileSizeKb : 128;

      if (!query && !filenameIncludes) {
        return 'file_search skipped: payload.query or payload.filenameIncludes missing';
      }

      const rootPath = path.resolve(process.cwd(), root);
      const results: { file: string; snippet?: string }[] = [];
      const stack = [rootPath];

      while (stack.length > 0 && results.length < maxResults) {
        const current = stack.pop();
        if (!current) {
          continue;
        }
        let entries: Awaited<ReturnType<typeof readdir>>;
        try {
          entries = await readdir(current, { withFileTypes: true });
        } catch {
          continue;
        }

        for (const entry of entries) {
          if (results.length >= maxResults) {
            break;
          }
          const entryPath = path.join(current, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
              continue;
            }
            stack.push(entryPath);
            continue;
          }
          if (!entry.isFile()) {
            continue;
          }

          if (extensions.length > 0 && !extensions.some((ext) => entry.name.endsWith(ext))) {
            continue;
          }
          if (filenameIncludes && !entry.name.includes(filenameIncludes)) {
            continue;
          }

          if (!query) {
            results.push({ file: entryPath });
            continue;
          }

          let info: Awaited<ReturnType<typeof stat>>;
          try {
            info = await stat(entryPath);
          } catch {
            continue;
          }
          if (info.size > maxFileSizeKb * 1024) {
            continue;
          }

          let contents: string;
          try {
            contents = await readFile(entryPath, 'utf-8');
          } catch {
            continue;
          }
          const index = contents.indexOf(query);
          if (index === -1) {
            continue;
          }

          const start = Math.max(0, index - 40);
          const end = Math.min(contents.length, index + query.length + 40);
          const snippet = contents
            .slice(start, end)
            .replace(/\s+/g, ' ')
            .trim();

          results.push({ file: entryPath, snippet });
        }
      }

      if (results.length === 0) {
        return `file_search: no matches for ${query ?? filenameIncludes}`;
      }

      const formatted = results
        .map((result) => {
          const relative = path.relative(process.cwd(), result.file);
          return result.snippet ? `${relative} :: ${result.snippet}` : relative;
        })
        .join(' | ');

      return `file_search results (${results.length}): ${formatted}`;
    },
  });

  registry.register({
    id: 'llm_generate',
    description: 'Generate a response using the configured LLM.',
    handler: async (input) => {
      const task = input.task as { summary?: string; payload?: Record<string, unknown> };
      const userPrompt =
        typeof task?.payload?.prompt === 'string' ? task.payload.prompt : undefined;
      const prompt = [
        `Task: ${task?.summary ?? 'task'}`,
        `Payload: ${JSON.stringify(task?.payload ?? {})}`,
        userPrompt ? `UserPrompt: ${userPrompt}` : null,
        'Return a concise response in Chinese.',
      ]
        .filter(Boolean)
        .join('\n');

      return llmGenerate(prompt);
    },
  });
}
