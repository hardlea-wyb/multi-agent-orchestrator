# Multi-Agent Orchestrator

一个务实的多 Agent 编排框架，用于构建协作式 Agent 工作流，具备明确角色、工具权限与执行追踪能力。

## 为什么要用
- 构建可预测、可检查、易扩展的 Agent 工作流
- 角色与工具权限清晰，便于治理与审计
- 输出执行轨迹，方便排错与复盘

## 功能特性
- 通过 YAML/JSON 定义 Agent 角色与能力
- 任务调度支持并发与失败重试
- 工具注册与访问控制
- 执行追踪与摘要
- 内置 HTTP 请求工具，方便对接真实服务
- 内置文件检索工具，便于本地代码发现
- 内置 LLM 工具（OpenAI 兼容接口）

## 快速开始
```bash
npm install
npm run dev
```

默认运行示例配置 `examples/agent-config.yaml`。

示例任务包含 `payload.url` 用于演示 HTTP 工具。
文件检索工具读取 `payload.root`、`payload.query` 及可选过滤条件。

## 命令行直用
无需修改 `src/cli.ts`，直接通过命令行传参生成任务：

```bash
npm run dev -- --summary "Vision Transformer" --topic "Vision Transformer" --url "https://arxiv.org/abs/2010.11929" --root "D:\\papers" --query "vision transformer" --extensions ".md,.txt" --prompt "请总结核心思想"
```

更简单的短命令：
```bash
npm run search -- "Vision Transformer" --url "https://arxiv.org/abs/2010.11929" --root "D:\\papers" --extensions ".md,.txt"
```

三段式工作流（先理解需求 -> 执行检索 -> 总结输出）：
```bash
npm run flow -- "Vision Transformer" --url "https://arxiv.org/abs/2010.11929" --root "D:\\papers" --pipeline deep
```

研发辅助工作流（需求分析 -> 模块定位 -> 方案建议）：
```bash
npm run flow -- "新增用户导出功能" --root "D:\\repo" --pipeline devassist --prompt "需求分析->模块定位->方案建议"
```

自然语言对话模式（自动抽取主题并触发 web_search）：
```bash
npm run chat -- "我想搜索相关DIT的内容"
```

## 网页搜索（自动找链接）
新增 `web_search` 工具，可自动找到网页链接并用于后续总结。

1) 准备搜索配置（本地文件，已在 `.gitignore` 忽略）
- `.searchrc.json` 或 `config/search.local.json`

示例：
```json
{
  "provider": "tavily",
  "apiKey": "your_search_key",
  "baseUrl": "https://api.tavily.com",
  "maxResults": 5,
  "timeoutMs": 30000
}
```

2) 直接使用
```bash
npm run flow -- "Vision Transformer" --pipeline deep
```

可选参数：
- `--search-provider` (`tavily`/`serpapi`)
- `--search-max-results`
- `--search-timeout-ms`
- `--search-config`

常用参数：
- `--config` 配置文件路径
- `--summary` 任务标题
- `--topic` 主题
- `--url` HTTP 工具抓取地址
- `--root` 本地检索根目录
- `--query` 检索关键字
- `--extensions` 扩展名列表（逗号分隔）
- `--filename-includes` 仅匹配文件名包含
- `--prompt` 提示词
- `--max-results` 最大匹配数
- `--max-file-size-kb` 文件大小限制
- `--http-timeout-ms` HTTP 超时

## 接入真实 LLM（本地配置文件）
优先读取 `.llmrc.json`，其次读取 `config/llm.local.json`，最后兜底环境变量。

使用 OpenAI 兼容接口，创建本地配置文件（已在 `.gitignore` 中忽略）。

示例：
```json
{
  "apiKey": "your_key",
  "baseUrl": "https://api.longcat.chat/openai",
  "model": "LongCat-Flash-Thinking-2601",
  "temperature": 0.7,
  "timeoutMs": 30000
}
```

也可使用 `config/llm.local.json`，格式相同。
对应工具为 `llm_generate`，已在示例配置中启用。

步骤：
1. 复制模板：`copy .llmrc.example.json .llmrc.json` 或创建 `config/llm.local.json`
2. 填入 `apiKey/baseUrl/model`
3. 运行：`npm run dev`

注意：配置文件包含密钥，请勿提交到仓库。

## 目录结构
```
src/
  agents/           # Agent 实现
  core/             # 调度、配置、追踪
  tools/            # 工具注册与内置工具
  cli.ts            # CLI 入口
examples/           # 示例配置与任务
docs/               # 架构说明
```

## 示例输出
```text
[analyst] Agent Requirements Analyst completed task: Analyze requirements for a new agent workflow
Goal: Break down the request into deliverables
Tools used: [summarize] Summary: Analyze requirements for a new agent workflow | payload keys: topic, priority | [checklist] Checklist: understand scope, identify inputs, produce output for Analyze requirements for a new agent workflow
```

## Roadmap
- 插件系统（自定义 Agent/Tool）
- 远程执行 Worker
- 执行轨迹可视化 UI

## License
MIT
