# @reaatech/agent-budget-llm-router-plugin

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-budget-llm-router-plugin.svg)](https://www.npmjs.com/package/@reaatech/agent-budget-llm-router-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-budget-controller/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-budget-controller/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Budget-aware routing strategy for LLM Router that filters model candidates by remaining budget, blocks requests when budgets are exhausted, and provides cost-based model ranking. Installs as the highest-priority strategy in the routing chain — above all other strategies including semantic and latency-based routing.

## Installation

```bash
npm install @reaatech/agent-budget-llm-router-plugin
# or
pnpm add @reaatech/agent-budget-llm-router-plugin
```

## Feature Overview

- **Priority-1 routing strategy** — evaluates before all other strategies (semantic, latency, cost)
- **Budget-based model filtering** — removes models whose estimated cost exceeds the remaining budget
- **Hard-block on exhaustion** — returns `{ blocked: true }` when no models fit the remaining budget
- **Per-request scope overrides** — request-level `scopeType`/`scopeKey` override the default scope
- **Configurable default scope** — fallback scope for requests that don't specify one
- **Always applicable** — `applies()` returns `true`, ensuring the budget check runs on every route

## Quick Start

```typescript
import { BudgetAwareStrategy } from '@reaatech/agent-budget-llm-router-plugin';
import { BudgetController } from '@reaatech/agent-budget-engine';
import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import { BudgetScope } from '@reaatech/agent-budget-types';

const store = new SpendStore();
const controller = new BudgetController({ spendTracker: store });

await controller.defineBudget({
  scopeType: BudgetScope.User,
  scopeKey: 'user-42',
  limit: 10.0,
  policy: { softCap: 0.8, hardCap: 1.0 },
});

const strategy = new BudgetAwareStrategy({
  controller,
  defaultScopeType: BudgetScope.User,
});

const result = strategy.select({
  scopeKey: 'user-42',
  models: [
    { id: 'claude-opus-4-1', estimatedCost: 0.15 },
    { id: 'claude-sonnet-4', estimatedCost: 0.05 },
    { id: 'claude-haiku-3-5', estimatedCost: 0.01 },
  ],
});

// result.models → models with costs ≤ remaining budget
// result.blocked → false (budget has room)
// result.reason → undefined
```

## API Reference

### `BudgetAwareStrategy`

| Method            | Description                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `select(request)` | Filter models by budget. Returns `RoutingResult` with surviving models and block status. |
| `applies()`       | Always returns `true` — this strategy runs on every route.                               |

#### Constructor

```typescript
new BudgetAwareStrategy(options: {
  controller: BudgetController;
  defaultScopeType?: BudgetScope;   // fallback if request doesn't specify
  defaultScopeKey?: string;         // fallback scope key
})
```

### Request & Result Types

```typescript
interface RoutingRequest {
  scopeType?: BudgetScope;
  scopeKey?: string;
  models: RoutingModel[];
}

interface RoutingModel {
  id: string;
  estimatedCost?: number;
}

interface RoutingResult {
  models: RoutingModel[];
  blocked: boolean;
  reason?: string;
}
```

## Usage Patterns

### Full LLM Router Integration

```typescript
import { BudgetAwareStrategy } from "@reaatech/agent-budget-llm-router-plugin";
import { Router } from "llm-router";
import { BudgetScope } from "@reaatech/agent-budget-types";

const budgetStrategy = new BudgetAwareStrategy({
  controller,
  defaultScopeType: BudgetScope.Org,
});

const router = new Router({
  strategies: [
    budgetStrategy,          // priority 1: budget enforcement
    myLatencyStrategy,        // priority 2: latency-based routing
    myCostStrategy,           // priority 3: cheapest available
  ],
});

const routed = await router.route({
  models: [
    { id: "claude-opus-4-1", estimatedCost: 0.15 },
    { id: "claude-sonnet-4", estimatedCost: 0.05 },
  ],
  budget: {
    scopeType: BudgetScope.User,
    scopeKey: "user-42",
  },
});

if (routed.blocked) {
  throw new BudgetExceededError({ ... });
}

// routed.model → cheapest model within budget
```

### Per-Request Scope Override

```typescript
// Default scope: Org "acme-corp"
const strategy = new BudgetAwareStrategy({
  controller,
  defaultScopeType: BudgetScope.Org,
  defaultScopeKey: 'acme-corp',
});

// Override scope per-request
const result = strategy.select({
  scopeType: BudgetScope.User,
  scopeKey: 'vip-user-7',
  models: [{ id: 'claude-opus-4-1', estimatedCost: 0.15 }],
});
// Uses user-7's budget, not acme-corp's
```

### Progressive Degradation

```typescript
const result = strategy.select({ models: expensiveModels });

if (result.blocked) {
  // All models exceed budget — fall back to cheapest possible
  result.models = [{ id: 'claude-haiku-3-5', estimatedCost: 0.001 }];
}
```

## Related Packages

- [`@reaatech/agent-budget-types`](https://www.npmjs.com/package/@reaatech/agent-budget-types) — Core types
- [`@reaatech/agent-budget-engine`](https://www.npmjs.com/package/@reaatech/agent-budget-engine) — Enforcement engine
- [`@reaatech/agent-budget-spend-tracker`](https://www.npmjs.com/package/@reaatech/agent-budget-spend-tracker) — Spend tracking
- [`@reaatech/agent-budget-pricing`](https://www.npmjs.com/package/@reaatech/agent-budget-pricing) — LLM pricing tables

## License

MIT — see [LICENSE](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE).
