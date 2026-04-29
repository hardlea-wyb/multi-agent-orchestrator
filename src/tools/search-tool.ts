type SearchOptions = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  maxResults?: number;
  timeoutMs?: number;
  configPath?: string;
};

type SearchResult = {
  title: string;
  url: string;
  snippet?: string;
};

type LocalSearchConfig = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  maxResults?: number;
  timeoutMs?: number;
};

let cachedConfig: LocalSearchConfig | null = null;
let configLoaded = false;

const loadLocalConfig = async (configPath?: string) => {
  if (configLoaded) {
    return cachedConfig ?? {};
  }

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const candidates = configPath
    ? [configPath]
    : ['.searchrc.json', path.join('config', 'search.local.json')];

  for (const candidate of candidates) {
    try {
      const filePath = path.resolve(process.cwd(), candidate);
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as LocalSearchConfig;
      cachedConfig = parsed ?? {};
      configLoaded = true;
      return cachedConfig;
    } catch {
      continue;
    }
  }

  configLoaded = true;
  cachedConfig = {};
  return cachedConfig;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
};

const normalizeResults = (items: SearchResult[]) =>
  items.filter((item) => item.title && item.url).slice(0, 10);

const searchWithTavily = async (
  query: string,
  apiKey: string,
  options: { baseUrl: string; maxResults: number; timeoutMs: number },
) => {
  const response = await withTimeout(
    fetch(`${options.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: options.maxResults,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
    }),
    options.timeoutMs,
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily error: ${response.status} ${response.statusText} ${text}`);
  }

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  const results = (data.results ?? []).map((item) => ({
    title: item.title ?? 'Untitled',
    url: item.url ?? '',
    snippet: item.content,
  }));

  return normalizeResults(results);
};

const searchWithSerpApi = async (
  query: string,
  apiKey: string,
  options: { baseUrl: string; maxResults: number; timeoutMs: number },
) => {
  const url = new URL(`${options.baseUrl}/search.json`);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', apiKey);

  const response = await withTimeout(fetch(url.toString()), options.timeoutMs);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpAPI error: ${response.status} ${response.statusText} ${text}`);
  }

  const data = (await response.json()) as {
    organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  const results = (data.organic_results ?? []).map((item) => ({
    title: item.title ?? 'Untitled',
    url: item.link ?? '',
    snippet: item.snippet,
  }));

  return normalizeResults(results).slice(0, options.maxResults);
};

export async function webSearch(query: string, options: SearchOptions = {}) {
  const localConfig = await loadLocalConfig(options.configPath);
  const provider =
    (options.provider ?? localConfig.provider ?? '').toLowerCase() || 'tavily';
  const apiKey = options.apiKey ?? localConfig.apiKey;
  const baseUrl = options.baseUrl ?? localConfig.baseUrl;
  const maxResults = options.maxResults ?? localConfig.maxResults ?? 5;
  const timeoutMs = options.timeoutMs ?? localConfig.timeoutMs ?? 30000;

  if (!apiKey) {
    throw new Error('Search API key is missing');
  }

  if (provider === 'serpapi') {
    return searchWithSerpApi(query, apiKey, {
      baseUrl: baseUrl ?? 'https://serpapi.com',
      maxResults,
      timeoutMs,
    });
  }

  return searchWithTavily(query, apiKey, {
    baseUrl: baseUrl ?? 'https://api.tavily.com',
    maxResults,
    timeoutMs,
  });
}

export type { SearchResult };
