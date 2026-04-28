# Architecture

## Core concepts
- **Agent role**: a named persona with a goal and an explicit tool list.
- **Task**: a unit of work with a summary and payload.
- **Tools**: discrete capabilities invoked by agents.
- **Dispatcher**: schedules tasks, controls concurrency, and retries failures.
- **Trace**: records execution events to support debugging and audits.

## Execution flow
1. Load config (YAML/JSON)
2. Register tools
3. Dispatch tasks across agents
4. Record events and summarize trace

## Extension points
- Add custom agents with domain-specific logic
- Add tools to integrate with external systems
- Swap logging and tracing backends
