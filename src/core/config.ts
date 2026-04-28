import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import YAML from 'yaml';
import { OrchestratorConfig } from './types.js';

const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  goal: z.string().min(1),
  tools: z.array(z.string()).default([]),
  priority: z.number().int().min(0).default(0),
});

const configSchema = z.object({
  project: z.string().min(1),
  maxConcurrency: z.number().int().min(1).default(3),
  retry: z.object({
    attempts: z.number().int().min(0).default(2),
    backoffMs: z.number().int().min(0).default(500),
  }),
  agents: z.array(agentSchema).min(1),
});

export async function loadConfig(path: string): Promise<OrchestratorConfig> {
  const raw = await readFile(path, 'utf-8');
  const parsed = path.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
  return configSchema.parse(parsed);
}
