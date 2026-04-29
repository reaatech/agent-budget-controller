# Agent Budget Controller

**Real-time LLM cost enforcement for agent systems.** Define per-task, per-user, per-session, or per-organization spend budgets. The controller intercepts every request, tracks spend in real time, and — as thresholds are reached — warns, downgrades models, disables expensive tools, or halts execution before costs spiral.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![pnpm >= 10](https://img.shields.io/badge/pnpm-%3E%3D10-orange.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![ESM + CJS](https://img.shields.io/badge/ESM%2BCJS-ff69b4.svg)]()

---

## Table of Contents

- [Why Agent Budget Controller?](#why-agent-budget-controller)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Scopes & Wildcards](#scopes--wildcards)
  - [Policies & Enforcement Actions](#policies--enforcement-actions)
  - [State Machine](#state-machine)
- [Packages](#packages)
- [Integration Options](#integration-options)
  - [Standalone (SDK Wrapper)](#standalone-sdk-wrapper)
  - [With LLM Router](#with-llm-router)
  - [With OpenTelemetry](#with-opentelemetry)
- [CLI](#cli)
- [Events & Observability](#events--observability)
- [Deployment Modes](#deployment-modes)
- [Performance](#performance)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

---

## Why Agent Budget Controller?

Autonomous agents can loop — retrying, searching, calling expensive models — and each step costs money. Without a budgeting layer, a single runaway agent can exhaust your LLM spend in minutes.

The **Agent Budget Controller** provides:

- **Pre-request gate:** Every LLM call is checked against a budget before it executes.
- **Real-time tracking:** Spend is recorded per-scope with sub-millisecond lookups.
- **Graceful degradation:** Warn first, downgrade models second, disable tools third — only hard-stop as a last resort.
- **Provider agnostic:** Works with Anthropic, OpenAI, Google, AWS Bedrock, and any provider you add to the pricing table.

---

## Features

- **Multi-scope budgets** — define budgets per task, user, session, or organization
- **Wildcard catch-all budgets** — `scopeKey: '*'` applies to all scopes of a given type; exact matches take priority
- **Configurable enforcement** — soft cap warnings, model auto-downgrade, tool filtering, hard cap blocking
- **Real-time spend tracking** — O(1) per-scope spend lookups with a memory-bounded circular buffer
- **Built-in pricing tables** — Anthropic, OpenAI, Google, AWS Bedrock with support for custom overrides
- **Event-driven observability** — emit events on state changes, threshold breaches, and hard stops
- **SDK wrapper** — `BudgetInterceptor` for wrapping non-HTTP agent loops
- **LLM Router plugin** — budget-aware routing strategy with model filtering
- **OpenTelemetry bridge** — consume GenAI spans and record costs automatically
- **CLI tool** — check budgets, generate reports, validate configs from the command line
- **Dual ESM/CJS** — published as both ES modules and CommonJS for maximum compatibility
- **Zero external dependencies** (runtime) — only `zod` for schema validation

---

## Prerequisites

| Requirement | Minimum |
| ----------- | ------- |
| Node.js     | 22.0.0  |
| pnpm        | 10.0.0  |

The project publishes dual ESM/CJS. Both `import` and `require()` are supported.

---

## Installation

The project is organized as a pnpm monorepo. Install individual packages as needed:

```bash
# Core packages (most users need these three)
pnpm add @reaatech/agent-budget-engine
pnpm add @reaatech/agent-budget-spend-tracker
pnpm add @reaatech/agent-budget-types

# Optional packages
pnpm add @reaatech/agent-budget-pricing          # Built-in pricing tables
pnpm add @reaatech/agent-budget-middleware       # SDK interceptor & HTTP utils
pnpm add @reaatech/agent-budget-otel-bridge      # OpenTelemetry integration
pnpm add @reaatech/agent-budget-llm-router-plugin # LLM Router strategy
pnpm add @reaatech/agent-budget-cli              # Command-line interface
```

---

## Quick Start

```typescript
import { BudgetController } from '@reaatech/agent-budget-engine';
import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import { BudgetScope, BudgetExceededError } from '@reaatech/agent-budget-types';

// 1. Create the spend tracker and controller
const spendTracker = new SpendStore({ maxEntries: 500_000 });
const controller = new BudgetController({ spendTracker });

// 2. Define a per-user budget
controller.defineBudget({
  scopeType: BudgetScope.User,
  scopeKey: 'user-123',
  limit: 10.0,
  policy: {
    softCap: 0.8,
    hardCap: 1.0,
    autoDowngrade: [{ from: ['claude-opus-4-1'], to: 'claude-sonnet-4' }],
    disableTools: ['web-search', 'code-exec'],
  },
});

// 3. Listen for enforcement events (optional but recommended)
controller.on('threshold-breach', (event) => {
  console.warn(`Budget ${event.scopeKey} at ${(event.threshold * 100).toFixed(0)}%`);
});
controller.on('hard-stop', (event) => {
  console.error(`Budget ${event.scopeKey} exhausted: $${event.spent.toFixed(2)}`);
});

// 4. Check budget before each agent step
const result = controller.check({
  scopeType: BudgetScope.User,
  scopeKey: 'user-123',
  estimatedCost: 0.05,
  modelId: 'claude-opus-4-1',
  tools: ['web-search', 'file-read'],
});

if (!result.allowed) {
  throw new BudgetExceededError('user-123', result.remaining, 10.0);
}

// Apply downgrade and tool filtering
const modelId = result.suggestedModel ?? 'claude-opus-4-1';
const tools =
  result.disabledTools.length > 0
    ? ['web-search', 'file-read'].filter((t) => !result.disabledTools.includes(t))
    : ['web-search', 'file-read'];

// 5. Record actual spend after the LLM call
controller.record({
  requestId: 'req-abc123',
  scopeType: BudgetScope.User,
  scopeKey: 'user-123',
  cost: 0.042,
  inputTokens: 2500,
  outputTokens: 800,
  modelId,
  provider: 'anthropic',
  timestamp: new Date(),
});
```

---

## Core Concepts

### Scopes & Wildcards

Budgets are isolated by scope — a combination of a dimension type and a unique key:

| Scope     | Description                  | Example Key    |
| --------- | ---------------------------- | -------------- |
| `task`    | Budget per individual task   | `"task-456"`   |
| `user`    | Budget per end-user          | `"user-123"`   |
| `session` | Budget per conversation      | `"sess-abc"`   |
| `org`     | Budget per organization/team | `"team-alpha"` |

Use `scopeKey: '*'` to define a catch-all wildcard budget. Exact matches take priority over wildcards:

```typescript
// Catch-all: all users capped at $10
controller.defineBudget({
  scopeType: BudgetScope.User,
  scopeKey: '*',
  limit: 10.0,
  policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
});

// Override: VIP users get $100
controller.defineBudget({
  scopeType: BudgetScope.User,
  scopeKey: 'vip-user-001',
  limit: 100.0,
  policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
});
```

### Policies & Enforcement Actions

Each budget has a policy that defines how enforcement behaves:

| Policy field    | Type              | Description                                     |
| --------------- | ----------------- | ----------------------------------------------- |
| `softCap`       | `number` (0–1)    | Ratio at which warnings and downgrades begin    |
| `hardCap`       | `number` (0–1)    | Ratio at which requests are rejected            |
| `autoDowngrade` | `DowngradeRule[]` | Model swap chains (e.g., Opus → Sonnet → Haiku) |
| `disableTools`  | `string[]`        | Tool names to remove when soft cap is reached   |

When a budget check runs, one of these actions is returned:

| Action          | Effect                                   |
| --------------- | ---------------------------------------- |
| `allow`         | Request proceeds normally                |
| `warn`          | Request proceeds, warning event emitted  |
| `degrade`       | Model swapped to a cheaper alternative   |
| `disable-tools` | Expensive tools removed from the request |
| `hard-stop`     | Request rejected entirely                |

### State Machine

Each scope transitions through states automatically as spend accumulates:

```
 active ──(soft cap reached)──▶ warned ──(downgrade triggered)──▶ degraded ──(hard cap reached)──▶ stopped
    ▲                                                                              │
    └───────────────────────────(budget reset)──────────────────────────────────────┘
```

Reset a budget back to `active` manually via `controller.reset(BudgetScope.User, 'user-123')`.

---

## Packages

| Package                                        | Description                                             | Dependencies             |
| ---------------------------------------------- | ------------------------------------------------------- | ------------------------ |
| `@reaatech/agent-budget-types`                 | Domain types, enums, and Zod schemas                    | `zod`                    |
| `@reaatech/agent-budget-pricing`               | LLM pricing tables with LRU cache and file overrides    | `types`                  |
| `@reaatech/agent-budget-spend-tracker`         | In-memory spend store with multi-index and spike detect | `types`                  |
| `@reaatech/agent-budget-engine`                | Enforcement engine, state machine, and event emitter    | `types`, `spend-tracker` |
| `@reaatech/agent-budget-middleware`            | `BudgetInterceptor` SDK wrapper and HTTP utilities      | `types`, `engine`        |
| `@reaatech/agent-budget-otel-bridge`           | OpenTelemetry GenAI span → spend recording bridge       | `types`, `engine`        |
| `@reaatech/agent-budget-llm-router-plugin`     | Budget-aware routing strategy for LLM Router            | `types`, `engine`        |
| `@reaatech/agent-budget-cli`                   | CLI for check, list, report, set, reset, validate       | `types`, `engine`        |

---

## Integration Options

### Standalone (SDK Wrapper)

Wrap your agent loop with `BudgetInterceptor` for a minimal integration with zero HTTP overhead:

```typescript
import { BudgetInterceptor } from '@reaatech/agent-budget-middleware';
import { BudgetScope } from '@reaatech/agent-budget-types';

const interceptor = new BudgetInterceptor({ controller });

// Before each step
const ctx = interceptor.beforeStep({
  scope: { scopeType: BudgetScope.User, scopeKey: 'user-123' },
  modelId: 'claude-opus-4-1',
  tools: ['web-search', 'file-read'],
});

if (!ctx.allowed) {
  // Budget exhausted — skip or abort the loop
  return;
}

// Use ctx.modelId (may be downgraded) and ctx.tools (may be filtered)
const response = await callLLM(ctx.modelId, ctx.tools);

// After each step
interceptor.afterStep({
  ...ctx,
  actualCost: response.cost,
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  requestId: response.id,
});
```

### With LLM Router

Register the budget-aware strategy at priority 1 to filter models before routing:

```typescript
import { BudgetAwareStrategy } from '@reaatech/agent-budget-llm-router-plugin';
import { BudgetScope } from '@reaatech/agent-budget-types';

const strategy = new BudgetAwareStrategy({
  controller,
  defaultScopeType: BudgetScope.User,
});

// In your LLM Router config, register this strategy at priority 1.
// It will:
//   1. Check remaining budget for the requested scope
//   2. Filter out models whose estimated cost exceeds the remaining budget
//   3. Apply downgrade rules if the soft cap has been breached
//   4. Pass the surviving models to lower-priority strategies
```

### With OpenTelemetry

If you already have OpenTelemetry GenAI instrumentation, bridge span attributes into the budget system:

```typescript
import { SpanListener } from '@reaatech/agent-budget-otel-bridge';

const listener = new SpanListener({ controller });

// When a GenAI span ends, pass its attributes:
listener.onSpanEnd({
  'budget.scope_type': 'user',
  'budget.scope_key': 'user-123',
  'llm.cost.total_usd': 0.05,
  'gen_ai.usage.input_tokens': 1000,
  'gen_ai.usage.output_tokens': 500,
  'gen_ai.request.model': 'claude-sonnet-4',
  'gen_ai.system': 'anthropic',
});
```

> Requires `@opentelemetry/api` as an optional peer dependency.

---

## CLI

```bash
# Define a budget
agent-budget set --scope user:user-123 --limit 10.00 --soft-cap 0.80

# Check remaining budget for a scope
agent-budget check user:user-123 --estimated-cost 0.05

# List all active budgets (table or JSON)
agent-budget list --format table < budgets.json

# Generate a spend report
agent-budget report --scope user:user-123 --period 24h --format json

# Reset a budget back to active
agent-budget reset user:user-123

# Validate a JSON config
agent-budget validate-config < config.json

# Simulate whether an estimated request fits the budget
agent-budget simulate --scope user:user-123 --model claude-opus-4-1 --input-tokens 1000
```

---

## Events & Observability

`BudgetController` extends `EventEmitter` and emits typed events for all state transitions:

```typescript
controller.on('state-change', (event) => {
  // { scopeType, scopeKey, from, to, reason, timestamp }
});

controller.on('threshold-breach', (event) => {
  // { scopeType, scopeKey, threshold, spent, limit, action, timestamp }
});

controller.on('hard-stop', (event) => {
  // { scopeType, scopeKey, spent, limit, timestamp }
});

controller.on('budget-reset', (event) => {
  // { scopeType, scopeKey, timestamp }
});
```

Listener errors are isolated — one failing listener does not block others.

---

## Deployment Modes

### In-Process (Single Node.js Process)

All components run in-process with an in-memory spend store (circular buffer, max 500K entries). Budget checks complete in under 1ms with zero network overhead. This is the recommended mode for single-instance deployments.

### Multi-Process / Containerized

The default in-memory `SpendStore` does not share state across processes. Each instance maintains its own spend view. For distributed deployments:

- Pin all requests for a given scope to the same instance (sticky sessions)
- Or accept eventually-consistent enforcement across instances

An external state backend (Redis) is planned for v2 to support shared state across processes.

---

## Performance

| Operation                    | Complexity | Target (p99) |
| ---------------------------- | ---------- | ------------ |
| Per-scope spend lookup       | O(1)       | < 1ms        |
| Budget check (`check()`)     | O(1)       | < 1ms        |
| Spend recording (`record()`) | O(1)       | < 1ms        |
| Scope state lookup           | O(1)       | < 1ms        |
| Spend rate calculation       | O(1)       | < 1ms        |
| Memory usage (500K entries)  | —          | ~120 MB      |

---

## Documentation

| Document          | Description                                          |
| ----------------- | ---------------------------------------------------- |
| [ARCHITECTURE.md] | System design, data flow, state machines             |
| [DEV_PLAN.md]     | Development roadmap and phase breakdown              |
| [AGENTS.md]       | AI agent skill definitions for automated development |
| [CONTRIBUTING.md] | Setup, coding standards, and PR guidelines           |
| [SECURITY.md]     | Vulnerability reporting and security considerations  |

[ARCHITECTURE.md]: ARCHITECTURE.md
[DEV_PLAN.md]: DEV_PLAN.md
[AGENTS.md]: AGENTS.md
[CONTRIBUTING.md]: CONTRIBUTING.md
[SECURITY.md]: SECURITY.md

---

## Roadmap

- [ ] Express/Fastify middleware with response header injection (`X-Budget-*`)
- [ ] OTLP metric receiver (HTTP/gRPC) for the OTel bridge
- [ ] Auto-downgrade integration with LLM Router fallback chains
- [ ] Cron-based automatic budget resets (daily/weekly/monthly)
- [ ] Redis-backed `SpendStore` for horizontal scaling
- [ ] Contract tests for otel-cost-exporter and llm-router integrations
- [ ] API reference documentation (TSDoc)
- [ ] npm publication

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md] for setup instructions, coding standards, and the pull request process.

Before submitting a PR, ensure:

```bash
pnpm build       # TypeScript compilation (dual ESM + CJS)
pnpm test        # All tests pass
pnpm lint        # Biome check passes
pnpm typecheck   # Strict type checking
pnpm format      # Biome formatting
```

---

## Security

Report vulnerabilities via [GitHub Security Advisories](https://github.com/reaatech/agent-budget-controller/security/advisories). Do not use the public issue tracker. See [SECURITY.md] for the full policy.

This library processes all data locally. No telemetry or spend data is sent to external services.

---

## License

MIT — see [LICENSE](LICENSE).
