# Multi-Agent Orchestrator

A pragmatic multi-agent orchestration framework for building collaborative agent workflows with clear roles, tool access, and execution tracing.

## Why
- Build agent workflows that are predictable, inspectable, and easy to extend.
- Keep agent roles explicit and enforce tool boundaries per role.
- Provide execution traces for audits and troubleshooting.

## Features
- Agent roles defined via YAML/JSON
- Task dispatcher with concurrency and retries
- Tool registry with guardrails
- Execution trace summary for observability

## Quick start
```bash
npm install
npm run dev
```

By default this runs the sample config in `examples/agent-config.yaml`.

## Project structure
```
src/
  agents/           # Agent implementations
  core/             # Dispatching, config, tracing
  tools/            # Tool registry and built-ins
  cli.ts            # CLI entry
examples/           # Sample configs and tasks
docs/               # Architecture notes
```

## Example output
```text
[analyst] Agent Requirements Analyst completed task: Analyze requirements for a new agent workflow
Goal: Break down the request into deliverables
Tools used: [summarize] Summary: Analyze requirements for a new agent workflow | payload keys: topic, priority | [checklist] Checklist: understand scope, identify inputs, produce output for Analyze requirements for a new agent workflow
```

## Roadmap
- Plugin system for custom agents and tools
- Remote execution workers
- Web UI for trace exploration

## License
MIT
