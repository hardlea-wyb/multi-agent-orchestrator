export type AgentRole = {
  id: string;
  name: string;
  goal: string;
  tools: string[];
  priority: number;
};

export type TaskInput = {
  id: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type TaskResult = {
  taskId: string;
  agentId: string;
  output: string;
  metadata?: Record<string, unknown>;
};

export type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export type ExecutionEvent = {
  timestamp: string;
  taskId: string;
  agentId: string;
  status: TaskStatus;
  message: string;
  detail?: Record<string, unknown>;
};

export type OrchestratorConfig = {
  project: string;
  maxConcurrency: number;
  retry: {
    attempts: number;
    backoffMs: number;
  };
  agents: AgentRole[];
};
