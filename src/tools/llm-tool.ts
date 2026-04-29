type LlmOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  configPath?: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type LocalLlmConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
};

let cachedConfig: LocalLlmConfig | null = null;
let configLoaded = false;

async function loadLocalConfig(configPath?: string) {
  if (configLoaded) {
    return cachedConfig ?? {};
  }

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const candidates = configPath
    ? [configPath]
    : ['.llmrc.json', path.join('config', 'llm.local.json')];

  for (const candidate of candidates) {
    try {
      const filePath = path.resolve(process.cwd(), candidate);
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as LocalLlmConfig;
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
}

export async function llmGenerate(prompt: string, options: LlmOptions = {}) {
  const localConfig = await loadLocalConfig(options.configPath);
  const apiKey = options.apiKey ?? localConfig.apiKey ?? process.env.LLM_API_KEY;
  const baseUrl =
    options.baseUrl ?? localConfig.baseUrl ?? process.env.LLM_BASE_URL ?? 'https://api.openai.com';
  const model = options.model ?? localConfig.model ?? process.env.LLM_MODEL ?? 'gpt-4o-mini';
  const temperature =
    options.temperature ?? localConfig.temperature ?? Number(process.env.LLM_TEMPERATURE ?? 0.2);
  const timeoutMs =
    options.timeoutMs ?? localConfig.timeoutMs ?? Number(process.env.LLM_TIMEOUT_MS ?? 30000);

  if (!apiKey) {
    throw new Error('LLM_API_KEY is missing');
  }

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${normalizedBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM error: ${response.status} ${response.statusText} ${text}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  } finally {
    clearTimeout(timer);
  }
}
