# @reaatech/agent-budget-engine

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-budget-engine.svg)](https://www.npmjs.com/package/@reaatech/agent-budget-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-budget-controller/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-budget-controller/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Budget enforcement engine with pre-flight checks, real-time spend recording, a per-scope state machine, auto-downgrade to cheaper models, and expensive tool filtering. The central orchestrator that connects spend tracking, pricing, and policy evaluation into a single budget enforcement pipeline.

## Installation

```bash
npm install @reaatech/agent-budget-engine
# or
pnpm add @reaatech/agent-budget-engine
```

## Feature Overview

- **Budget lifecycle management** — `defineBudget()`, `undefineBudget()`, `getBudget()`, `reset()`
- **Pre-flight checks** — `check()` estimates cost and determines whether a request is allowed
- **Real-time spend recording** — `record()` tracks actual spend and updates per-scope state
- **State machine** — per-scope lifecycle: `Active → Warned → Degraded → Stopped`
- **Soft/hard cap policy** — `PolicyEvaluator` determines enforcement action based on utilization
- **Auto-downgrade engine** — `DowngradeEngine` suggests cheaper models when budgets tighten
- **Tool filtering** — `ToolFilter` removes expensive tools from request payloads
- **Event emitter** — subscribe to `state-change`, `threshold-breach`, `hard-stop`, `budget-reset`
- **Wildcard budgets** — define catch-all budgets (scope key `*`) that apply to all unmatched scopes
- **Pricing integration** — accepts any `PricingProvider` for cost estimation (works with `@reaatech/agent-budget-pricing`)

## Quick Start

```typescript
import { BudgetController } from '@reaatech/agent-budget-engine';
import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import { BudgetScope } from '@reaatech/agent-budget-types';

const store = new SpendStore();
const controller = new BudgetController({ spendTracker: store });

await controller.defineBudget({
  scopeType: BudgetScope.User,
  scopeKey: 'user-42',
  limit: 10.0,
  policy: {
    softCap: 0.8,
    hardCap: 1.0,
    autoDowngrade: [{ from: ['claude-opus-4-1'], to: 'claude-sonnet-4' }],
    disableTools: ['web-search-premium'],
  },
});

const check = await controller.check({
  scopeType: BudgetScope.User,
  scopeKey: 'user-42',
  estimatedCost: 0.05,
  modelId: 'claude-opus-4-1',
  tools: ['web-search', 'web-search-premium'],
});
// → { allowed: true, action: "Allow", suggestedModel: "...", disabledTools: [...] }

await controller.record({
  requestId: 'req-1',
  scopeType: BudgetScope.User,
  scopeKey: 'user-42',
  cost: 0.045,
  inputTokens: 1500,
  outputTokens: 200,
  modelId: 'claude-sonnet-4',
  provider: 'anthropic',
  timestamp: new Date(),
});

const state = controller.getState(BudgetScope.User, 'user-42');
// → { spent: 0.045, remaining: 9.955, state: "Active", ... }
```

## API Reference

### `BudgetController`

The central orchestrator. All enforcement flows through this class.

| Method                                           | Description                                                    |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `defineBudget(definition)`                       | Create or update a budget for a scope                          |
| `undefineBudget(scopeType, scopeKey)`            | Remove a budget definition                                     |
| `getBudget(scopeType, scopeKey)`                 | Get the budget definition for a scope (with wildcard fallback) |
| `check(request)`                                 | Pre-flight budget check — returns `BudgetCheckResult`          |
| `record(entry)`                                  | Record actual spend after a request completes                  |
| `getState(scopeType, scopeKey)`                  | Get current budget runtime state                               |
| `suggestDowngrade(modelId, scopeType, scopeKey)` | Get the cheapest allowed model for a scope                     |
| `getDisabledTools(scopeType, scopeKey)`          | Get the list of tools currently disabled for a scope           |
| `reset(scopeType, scopeKey)`                     | Manually reset a budget (clears spend, resets state)           |
| `listAll()`                                      | List all defined budgets                                       |

#### Events

All transitions emit typed events:

| Event              | Payload                | Fires When                           |
| ------------------ | ---------------------- | ------------------------------------ |
| `state-change`     | `StateChangeEvent`     | Scope transitions between states     |
| `threshold-breach` | `ThresholdBreachEvent` | Spend crosses a soft or hard cap     |
| `hard-stop`        | `HardStopEvent`        | A request is blocked at the hard cap |
| `budget-reset`     | `BudgetResetEvent`     | A budget is manually reset           |

```typescript
controller.on('threshold-breach', (event) => {
  console.warn(`Budget at ${event.threshold * 100}% for ${event.scopeType}:${event.scopeKey}`);
});
```

#### State Machine

Valid state transitions are enforced automatically:

```
Active ──(soft cap reached)──▶ Warned ──(downgrade triggered)──▶ Degraded ──(hard cap reached)──▶ Stopped
  ▲                                                                                     │
  └──────────────────────────────(budget reset)──────────────────────────────────────────┘
```

#### Constructor

```typescript
new BudgetController(options: {
  spendTracker: SpendStore;
  pricing?: PricingProvider;
  defaultEstimateTokens?: number;  // default: 1000
})
```

### `PolicyEvaluator`

Evaluates spend against budget policy caps. Used internally by `BudgetController` but exposed for custom pipelines.

```typescript
import { PolicyEvaluator } from '@reaatech/agent-budget-engine';

const evaluator = new PolicyEvaluator();
const result = evaluator.evaluate(
  spent, // current spend in dollars
  limit, // budget limit in dollars
  policy, // BudgetPolicy with softCap/hardCap
  currentModel, // optional: model ID to check against downgrade rules
  currentTools, // optional: tool names to filter
);
// → { action: EnforcementAction; triggeredThresholds: number[]; ... }
```

### `DowngradeEngine`

Model swap logic. Supports wildcard rules (`*` matches any model).

```typescript
import { DowngradeEngine } from '@reaatech/agent-budget-engine';

const engine = new DowngradeEngine();
const suggested = engine.suggestDowngrade('claude-opus-4-1', [
  { from: ['claude-opus-4-1'], to: 'claude-sonnet-4' },
  { from: ['*'], to: 'claude-haiku-3-5' }, // catch-all fallback
]);
// → "claude-sonnet-4"

const chain = engine.getDowngradeChain('claude-opus-4-1', rules);
// → ["claude-sonnet-4", "claude-haiku-3-5"]
```

### `ToolFilter`

```typescript
import { ToolFilter } from '@reaatech/agent-budget-engine';

const filter = new ToolFilter();
const result = filter.filter(
  ['web-search', 'code-interpreter', 'web-search-premium'],
  ['web-search-premium', 'code-interpreter'],
);
// → { original: [...], filtered: ["web-search"], disabled: ["web-search-premium", "code-interpreter"] }
```

## Usage Patterns

### Wildcard Budgets

```typescript
await controller.defineBudget({
  scopeType: BudgetScope.User,
  scopeKey: '*',
  limit: 5.0,
  policy: { softCap: 0.8, hardCap: 1.0 },
});

await controller.defineBudget({
  scopeType: BudgetScope.User,
  scopeKey: 'power-user-99',
  limit: 50.0,
  policy: { softCap: 0.8, hardCap: 1.0 },
});
```

## Advanced: Auto-Downgrade Flow

```typescript
const check = await controller.check({
  scopeType: BudgetScope.User,
  scopeKey: 'user-42',
  estimatedCost: 0.15,
  modelId: 'claude-opus-4-1',
  tools: ['web-search'],
});

const actualModel = check.suggestedModel ?? 'claude-opus-4-1';
const actualTools = check.disabledTools
  ? check.tools.filter((t) => !check.disabledTools.includes(t))
  : check.tools;
```

## Advanced: Event-Driven Alerting

```typescript
controller.on('hard-stop', (event) => {
  alertingService.fire({
    severity: 'critical',
    message: `Budget exhausted for ${event.scopeType}:${event.scopeKey}`,
    details: { spent: event.spent, limit: event.limit },
  });
});

controller.on('threshold-breach', (event) => {
  if (event.threshold === 0.9) {
    notificationService.notify(`90% budget used for ${event.scopeType}:${event.scopeKey}`);
  }
});
```

## Error Handling

The controller throws typed errors from `@reaatech/agent-budget-types`:

| Error | When |
|-------|------|
| `BudgetExceededError` | A check or record exceeds the hard cap |
| `BudgetValidationError` | Invalid budget definition or scope |

Check results before recording:

```typescript
const result = await controller.check(request);
if (!result.allowed) {
  throw new BudgetExceededError({
    scope: { scopeType: request.scopeType, scopeKey: request.scopeKey },
    spent,
    limit,
    remaining: result.remaining,
  });
}
```

## Related Packages

- [`@reaatech/agent-budget-types`](https://www.npmjs.com/package/@reaatech/agent-budget-types) — Core types and Zod schemas
- [`@reaatech/agent-budget-spend-tracker`](https://www.npmjs.com/package/@reaatech/agent-budget-spend-tracker) — Spend tracking data layer
- [`@reaatech/agent-budget-pricing`](https://www.npmjs.com/package/@reaatech/agent-budget-pricing) — LLM pricing tables
- [`@reaatech/agent-budget-middleware`](https://www.npmjs.com/package/@reaatech/agent-budget-middleware) — HTTP middleware wrapper
- [`@reaatech/agent-budget-otel-bridge`](https://www.npmjs.com/package/@reaatech/agent-budget-otel-bridge) — OpenTelemetry span bridge
- [`@reaatech/agent-budget-llm-router-plugin`](https://www.npmjs.com/package/@reaatech/agent-budget-llm-router-plugin) — LLM Router strategy

## License

MIT — see [LICENSE](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE).
