# @reaatech/agent-budget-middleware

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-budget-middleware.svg)](https://www.npmjs.com/package/@reaatech/agent-budget-middleware)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-budget-controller/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-budget-controller/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Express/Fastify-compatible middleware and a direct SDK wrapper (`BudgetInterceptor`) that integrates budget enforcement into any agent server. Injects budget response headers, intercepts model selection for auto-downgrade, and filters expensive tools — all before the LLM call reaches your application code.

## Installation

```bash
npm install @reaatech/agent-budget-middleware
# or
pnpm add @reaatech/agent-budget-middleware
```

## Feature Overview

- **`BudgetInterceptor`** — direct SDK wrapper for non-HTTP agents (worker threads, CLI agents, job queues)
- **`createBudgetMiddleware`** — Express/Fastify-compatible HTTP middleware factory
- **Pre-request budget check** — validates estimated cost against remaining budget before the LLM call
- **Auto-downgrade interception** — swaps model selection if budget has tightened
- **Tool filtering** — removes expensive tools from the request when budget is constrained
- **Post-request spend recording** — records actual token usage and cost after the LLM call
- **Budget response headers** — injects `X-Budget-Remaining`, `X-Budget-Status`, `X-Budget-Suggested-Model`
- **Scope extraction from HTTP** — reads `x-budget-scope-type` and `x-budget-scope-key` headers

## Quick Start

### With Express

```typescript
import express from 'express';
import { createBudgetMiddleware } from '@reaatech/agent-budget-middleware';
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

const middleware = createBudgetMiddleware({ controller });

const app = express();
app.use(express.json());
app.use('/agent', middleware.beforeStep);
app.use('/agent', middleware.afterStep);

app.post('/agent', (req, res) => {
  // req.budgetContext contains { scope, allowed, modelId, tools, ... }
  if (!req.budgetContext.allowed) {
    return res.status(402).json({ error: 'Budget exceeded' });
  }
  // Use req.budgetContext.modelId and req.budgetContext.tools for the LLM call
  res.json({ status: 'ok' });
});

app.listen(3000);
```

### With Fastify

```typescript
import Fastify from 'fastify';
import { createBudgetMiddleware } from '@reaatech/agent-budget-middleware';

const fastify = Fastify();
const middleware = createBudgetMiddleware({ controller });

fastify.addHook('preHandler', middleware.beforeStep);
fastify.addHook('onResponse', middleware.afterStep);
```

### Direct SDK Usage (non-HTTP)

```typescript
import { BudgetInterceptor } from '@reaatech/agent-budget-middleware';
import { BudgetController } from '@reaatech/agent-budget-engine';
import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import { BudgetScope } from '@reaatech/agent-budget-types';

const store = new SpendStore();
const controller = new BudgetController({ spendTracker: store });
const interceptor = new BudgetInterceptor({ controller });

// Before LLM call
const ctx = await interceptor.beforeStep({
  scopeType: BudgetScope.User,
  scopeKey: 'user-42',
  modelId: 'claude-opus-4-1',
  estimatedCost: 0.15,
  tools: ['web-search', 'code-interpreter'],
});

if (!ctx.allowed) throw new Error(`Budget exceeded: ${ctx.reason}`);

// Use ctx.modelId and ctx.tools for the actual LLM call
const llmResult = await callLLM(ctx.modelId, ctx.tools);

// After LLM call — record actual spend
await interceptor.afterStep({
  ...ctx,
  actualCost: llmResult.cost,
  inputTokens: llmResult.inputTokens,
  outputTokens: llmResult.outputTokens,
  requestId: 'req-abc123',
});
```

## API Reference

### `BudgetInterceptor`

| Method               | Description                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `beforeStep(params)` | Pre-flight budget check. Returns `InterceptorContext` with potentially downgraded model and filtered tools. Throws `BudgetExceededError` if the request is blocked. |
| `afterStep(params)`  | Records actual spend after the LLM call completes. Accepts `InterceptorAfterContext` with actual cost and token counts.                                             |

#### `BudgetInterceptorOptions`

```typescript
interface BudgetInterceptorOptions {
  controller: BudgetController;
}
```

### `createBudgetMiddleware`

Factory function that returns Express/Fastify middleware handlers.

```typescript
function createBudgetMiddleware(options: { controller: BudgetController }): {
  beforeStep: (req, res, next) => Promise<void>;
  afterStep: (req, res, next) => Promise<void>;
};
```

The `beforeStep` handler reads scope from HTTP headers:

| Header                | Value                                   |
| --------------------- | --------------------------------------- |
| `x-budget-scope-type` | One of `task`, `user`, `session`, `org` |
| `x-budget-scope-key`  | The scope identifier (e.g., `user-42`)  |

It injects the following response headers:

| Header                     | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| `X-Budget-Remaining`       | Dollars remaining in the budget                          |
| `X-Budget-Status`          | Current state: `active`, `warned`, `degraded`, `stopped` |
| `X-Budget-Limit`           | Total budget limit                                       |
| `X-Budget-Spent`           | Dollars spent so far                                     |
| `X-Budget-Suggested-Model` | Model to use (if downgrade was applied)                  |

The `afterStep` handler records the actual spend and cleans up context.

## Usage Patterns

### Progressive Response: Warn Then Block

```typescript
app.post(
  '/agent',
  middleware.beforeStep,
  (req, res, next) => {
    const ctx = req.budgetContext;

    if (!ctx.allowed) {
      const retryAfter = res.get('Retry-After') ?? '3600';
      return res.status(402).json({
        error: 'Budget exhausted',
        budget: {
          limit: res.get('X-Budget-Limit'),
          spent: res.get('X-Budget-Spent'),
          suggestedModel: res.get('X-Budget-Suggested-Model'),
        },
      });
    }

    if (ctx.warning) {
      res.set('X-Budget-Warning', ctx.warning);
    }

    next();
  },
  middleware.afterStep,
);
```

### Custom Scope Extraction

```typescript
import { BudgetInterceptor } from '@reaatech/agent-budget-middleware';

const interceptor = new BudgetInterceptor({ controller });

// Scope from JWT claims, not HTTP headers
const scope = { scopeType: BudgetScope.Org, scopeKey: jwtPayload.orgId };

const ctx = await interceptor.beforeStep({
  ...scope,
  modelId: 'claude-sonnet-4',
  estimatedCost: 0.05,
});
```

## Related Packages

- [`@reaatech/agent-budget-types`](https://www.npmjs.com/package/@reaatech/agent-budget-types) — Core types and schemas
- [`@reaatech/agent-budget-engine`](https://www.npmjs.com/package/@reaatech/agent-budget-engine) — Enforcement engine
- [`@reaatech/agent-budget-spend-tracker`](https://www.npmjs.com/package/@reaatech/agent-budget-spend-tracker) — Spend tracking
- [`@reaatech/agent-budget-pricing`](https://www.npmjs.com/package/@reaatech/agent-budget-pricing) — LLM pricing tables
- [`@reaatech/agent-budget-otel-bridge`](https://www.npmjs.com/package/@reaatech/agent-budget-otel-bridge) — OpenTelemetry bridge
- [`@reaatech/agent-budget-cli`](https://www.npmjs.com/package/@reaatech/agent-budget-cli) — CLI for budget management

## License

MIT — see [LICENSE](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE).
