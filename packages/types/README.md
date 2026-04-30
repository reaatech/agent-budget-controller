# @reaatech/agent-budget-types

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-budget-types.svg)](https://www.npmjs.com/package/@reaatech/agent-budget-types)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-budget-controller/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-budget-controller/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Core domain types, Zod validation schemas, and error classes for the agent-budget-controller ecosystem. This package is the single source of truth for all budget shapes — scopes, policies, enforcement actions, spend entries, and state transitions — used throughout every `@reaatech/agent-budget-*` package.

## Installation

```bash
npm install @reaatech/agent-budget-types
# or
pnpm add @reaatech/agent-budget-types
```

## Feature Overview

- **4 budget scopes** — `Task`, `User`, `Session`, `Org` with Zod-validated identifiers
- **Budget definition types** — dollar limits, cap thresholds (soft/hard), downgrade rules, and tool exclusions
- **5 enforcement actions** — `Allow`, `Warn`, `Degrade`, `DisableTools`, `HardStop` as a typed state machine
- **4-state lifecycle** — `Active → Warned → Degraded → Stopped` with transition history tracking
- **Spend entry schema** — typed cost events with tokens, model IDs, providers, and timestamps
- **4 typed error classes** — `BudgetError`, `BudgetExceededError`, `BudgetValidationError` with structured serialization
- **Zod schemas for every type** — parse and validate at runtime boundaries (API, CLI, middleware)
- **Zero runtime dependencies** beyond `zod` — tree-shakeable and lightweight

## Quick Start

```typescript
import { BudgetScope, BudgetPolicy, type SpendEntry } from '@reaatech/agent-budget-types';

const scope = { scopeType: BudgetScope.User, scopeKey: 'user-42' };

const policy: BudgetPolicy = {
  softCap: 0.8,
  hardCap: 1.0,
  autoDowngrade: [{ from: ['claude-opus-4-1'], to: 'claude-sonnet-4' }],
  disableTools: ['expensive-web-search'],
};
```

## Exports

### Budget Scopes

| Export                    | Kind      | Description                                      |
| ------------------------- | --------- | ------------------------------------------------ |
| `BudgetScope`             | enum      | `Task`, `User`, `Session`, `Org`                 |
| `ScopeIdentifier`         | interface | `{ scopeType; scopeKey }`                        |
| `ScopeResolver<TContext>` | type      | `(context: TContext) => ScopeIdentifier \| null` |

### Budget Configuration

| Export             | Kind      | Description                                     |
| ------------------ | --------- | ----------------------------------------------- |
| `BudgetPolicy`     | interface | Soft/hard caps, downgrade rules, disabled tools |
| `BudgetDefinition` | interface | Full budget: scope, dollar limit, policy        |

### Enforcement & State Machine

| Export              | Kind      | Description                                            |
| ------------------- | --------- | ------------------------------------------------------ |
| `EnforcementAction` | enum      | `Allow`, `Warn`, `Degrade`, `DisableTools`, `HardStop` |
| `BudgetStateEnum`   | enum      | `Active`, `Warned`, `Degraded`, `Stopped`              |
| `StateTransition`   | interface | Records each state machine transition                  |
| `EnforcementResult` | interface | Outcome of a budget enforcement check                  |

### Spend Tracking

| Export           | Kind      | Description                                                 |
| ---------------- | --------- | ----------------------------------------------------------- |
| `SpendEntry`     | interface | Single cost event: requestId, tokens, model, provider, cost |
| `SpendQuery`     | interface | Filter criteria for querying spend history                  |
| `BudgetState`    | interface | Full runtime budget state with spent/remaining/breach count |
| `BudgetSnapshot` | interface | Lightweight budget status summary                           |

### Downgrade & Tools

| Export             | Kind      | Description                                                 |
| ------------------ | --------- | ----------------------------------------------------------- |
| `DowngradeRule`    | interface | Maps model IDs to cheaper alternatives (supports wildcards) |
| `ToolCostConfig`   | interface | Assigns cost weight to a tool                               |
| `ToolFilterResult` | interface | Result of filtering tool lists                              |

### Budget Checks

| Export               | Kind      | Description                                       |
| -------------------- | --------- | ------------------------------------------------- |
| `BudgetCheckRequest` | interface | Pre-flight check request with estimated cost      |
| `BudgetCheckResult`  | interface | Check result with allowed/blocked/suggested model |

### Error Classes

| Export                  | Kind  | Description                                                                   |
| ----------------------- | ----- | ----------------------------------------------------------------------------- |
| `BudgetError`           | class | Base error with `code` and optional `scope`                                   |
| `BudgetExceededError`   | class | Hard-cap violation with spent/limit/remaining                                 |
| `BudgetValidationError` | class | Invalid input with optional `field`                                           |
| `BudgetErrorCode`       | enum  | `BUDGET_EXCEEDED`, `BUDGET_VALIDATION`, `BUDGET_NOT_FOUND`, `BUDGET_INTERNAL` |

## Usage Pattern

Every type has a corresponding Zod schema for runtime validation:

```typescript
import { BudgetPolicySchema, BudgetDefinitionSchema } from '@reaatech/agent-budget-types';

const raw = JSON.parse(userInput);
const validated = BudgetDefinitionSchema.parse(raw); // throws BudgetValidationError on failure
```

Error classes support structured serialization for API responses:

```typescript
import { BudgetExceededError } from '@reaatech/agent-budget-types';

throw new BudgetExceededError({
  scope: { scopeType: 'user', scopeKey: '42' },
  spent: 10.0,
  limit: 10.0,
  remaining: 0,
});
// BudgetExceededError.toJSON() → { name, message, code, spent, limit, ... }
```

## Related Packages

- [`@reaatech/agent-budget-engine`](https://www.npmjs.com/package/@reaatech/agent-budget-engine) — Enforcement engine that consumes these types
- [`@reaatech/agent-budget-spend-tracker`](https://www.npmjs.com/package/@reaatech/agent-budget-spend-tracker) — Real-time spend tracking
- [`@reaatech/agent-budget-pricing`](https://www.npmjs.com/package/@reaatech/agent-budget-pricing) — LLM pricing tables
- [`@reaatech/agent-budget-middleware`](https://www.npmjs.com/package/@reaatech/agent-budget-middleware) — Express/Fastify middleware
- [`@reaatech/agent-budget-cli`](https://www.npmjs.com/package/@reaatech/agent-budget-cli) — CLI for budget management

## License

[MIT](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE)
