# @reaatech/agent-budget-spend-tracker

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-budget-spend-tracker.svg)](https://www.npmjs.com/package/@reaatech/agent-budget-spend-tracker)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-budget-controller/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-budget-controller/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Real-time spend tracking with a circular-buffer store, multi-index lookups, sliding-window aggregation, and anomaly detection. Designed for sub-millisecond per-scope spend queries at scale — the core data layer behind every budget enforcement check.

## Installation

```bash
npm install @reaatech/agent-budget-spend-tracker
# or
pnpm add @reaatech/agent-budget-spend-tracker
```

## Feature Overview

- **Circular buffer store** — configurable up to 500K entries, oldest evicted automatically
- **O(1) per-scope spend lookup** — instant total computation via pre-aggregated indexes
- **Three indexes** — by scope, by time bucket (per-minute), and by model ID
- **Sliding-window spend rate** — `getRate()` returns spend-per-minute over configurable windows
- **Cost projection** — `projectTotal()` estimates spend over a configurable time horizon
- **Spike detection** — standard-deviation-based anomaly detection for unexpected spend bursts
- **Multi-scope queries** — filter by scope type, time range, model, or any combination
- **Zero external dependencies** — pure in-memory, no database required

## Quick Start

```typescript
import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import { BudgetScope } from '@reaatech/agent-budget-types';

const store = new SpendStore({ maxEntries: 100_000 });

store.record({
  requestId: 'req-abc123',
  scopeType: BudgetScope.User,
  scopeKey: 'user-42',
  cost: 0.045,
  inputTokens: 1500,
  outputTokens: 300,
  modelId: 'claude-sonnet-4',
  provider: 'anthropic',
  timestamp: new Date(),
});

const spent = store.getSpend(BudgetScope.User, 'user-42');
// → 0.045

const rate = store.getRate(BudgetScope.User, 'user-42', 5); // last 5 minutes
// → 0.009 per minute
```

## API Reference

### `SpendStore`

| Method                                                       | Description                                                            |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `record(entry)`                                              | Record a spend event. Returns an auto-incremented entry ID.            |
| `getSpend(scopeType, scopeKey)`                              | Get total spend for a scope. O(1).                                     |
| `getRate(scopeType, scopeKey, windowMinutes?)`               | Spend per minute over the last N minutes (default: 1).                 |
| `projectTotal(scopeType, scopeKey, windowHours?)`            | Projected total spend over N hours (default: 1) based on current rate. |
| `detectSpikes(scopeType, scopeKey, thresholdStdDev?)`        | Detect abnormal spend bursts. Returns spike entries.                   |
| `getEntriesInRange(scopeType, scopeKey, startTime, endTime)` | Query entries in a time range.                                         |
| `getRecentEntries(count)`                                    | Get the N most recent entries across all scopes.                       |
| `getEntriesByModel(modelId)`                                 | Get entries for a specific model across all scopes.                    |
| `getAllScopes(scopeType)`                                    | List all scope keys that have entries for a given scope type.          |
| `size`                                                       | Total number of entries currently in the store.                        |

#### Constructor

```typescript
new SpendStore(options?: {
  maxEntries?: number; // default: 500_000
})
```

### `SpendAccumulator`

Internal interface exposed for inspection:

```typescript
interface SpendAccumulator {
  total: number;
  entryIds: number[];
}
```

## Usage Patterns

### Spike Detection

```typescript
const store = new SpendStore();

// Record normal traffic...
for (const entry of normalEntries) store.record(entry);

// Detect anomalies — entries more than 2 standard deviations above the mean
const spikes = store.detectSpikes(BudgetScope.User, 'user-42', 2);
for (const spike of spikes) {
  console.warn(`Spike: $${spike.cost} — model ${spike.modelId}`);
}
```

### Multi-Scope Budget Tracking

```typescript
// Track spend per-user, per-org, and globally
store.record({ ...entry, scopeType: BudgetScope.User, scopeKey: 'user-42', cost: 0.01 });
store.record({ ...entry, scopeType: BudgetScope.Org, scopeKey: 'org-acme', cost: 0.01 });

const userSpend = store.getSpend(BudgetScope.User, 'user-42'); // → 0.01
const orgSpend = store.getSpend(BudgetScope.Org, 'org-acme'); // → 0.01
```

### Integration with Budget Engine

```typescript
import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import { BudgetController } from '@reaatech/agent-budget-engine';

const store = new SpendStore({ maxEntries: 500_000 });
const controller = new BudgetController({ spendTracker: store });

// BudgetController automatically records spend via store.record()
await controller.defineBudget({
  scopeType: BudgetScope.User,
  scopeKey: 'user-42',
  limit: 10.0,
  policy: { softCap: 0.8, hardCap: 1.0 },
});

await controller.record({
  requestId: 'req-1',
  scopeType: BudgetScope.User,
  scopeKey: 'user-42',
  cost: 2.5,
  inputTokens: 800,
  outputTokens: 200,
  modelId: 'claude-opus-4-1',
  provider: 'anthropic',
  timestamp: new Date(),
});
```

## Related Packages

- [`@reaatech/agent-budget-types`](https://www.npmjs.com/package/@reaatech/agent-budget-types) — Core types (BudgetScope, SpendEntry)
- [`@reaatech/agent-budget-engine`](https://www.npmjs.com/package/@reaatech/agent-budget-engine) — Enforcement engine
- [`@reaatech/agent-budget-pricing`](https://www.npmjs.com/package/@reaatech/agent-budget-pricing) — LLM pricing tables
- [`@reaatech/agent-budget-cli`](https://www.npmjs.com/package/@reaatech/agent-budget-cli) — CLI for budget management

## License

MIT — see [LICENSE](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE).
