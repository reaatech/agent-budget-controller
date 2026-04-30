# @reaatech/agent-budget-pricing

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-budget-pricing.svg)](https://www.npmjs.com/package/@reaatech/agent-budget-pricing)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-budget-controller/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-budget-controller/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

LLM pricing table management with LRU-cached lookups, model name normalization, and cost computation. Ships with built-in pricing for Anthropic, OpenAI, Google, and AWS Bedrock.

## Installation

```bash
npm install @reaatech/agent-budget-pricing
# or
pnpm add @reaatech/agent-budget-pricing
```

## Feature Overview

- **4 providers built in** — Anthropic (Claude), OpenAI (GPT/o-series), Google (Gemini), AWS Bedrock (multi-model)
- **Token cost computation** — `computeCost(inputTokens, outputTokens, modelId)` returns exact dollar cost
- **Cost estimation** — `estimateCost(modelId, estimatedInputTokens)` for pre-flight budget checks
- **Model name normalization** — `ModelNormalizer` maps provider aliases to canonical model IDs
- **LRU cache with TTL** — configurable cache TTL (default 1 hour) avoids repeated table lookups
- **Programmatic table loading** — `loadTable(provider, models)` for custom or updated pricing
- **File-based overrides** — load pricing from JSON files to override or extend built-in tables
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import { PricingEngine } from '@reaatech/agent-budget-pricing';

const pricing = new PricingEngine({ cacheTtlMs: 3600_000 });

const cost = pricing.computeCost(500, 200, 'claude-sonnet-4', 'anthropic');
// → 0.0045  (500/1M × $3 + 200/1M × $15)

const estimate = pricing.estimateCost('claude-sonnet-4', 1000, 'anthropic');
// → 0.003   (1000/1M × $3 input, assuming 0.2 output ratio)
```

## API Reference

### `PricingEngine`

| Method                                                                 | Description                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| `lookup(modelId, provider?)`                                           | Look up `PriceEntry` for a model. Returns `null` if unknown. |
| `computeCost(inputTokens, outputTokens, modelId, provider?)`           | Calculate dollar cost for actual token usage                 |
| `estimateCost(modelId, estimatedInputTokens, provider?, outputRatio?)` | Estimate cost before the call (default output ratio: 0.2)    |
| `loadTable(provider, models)`                                          | Load or replace pricing data for a provider                  |
| `clearCache()`                                                         | Invalidate the LRU cache                                     |

#### Constructor

```typescript
new PricingEngine(options?: {
  cacheTtlMs?: number;    // default: 3600_000 (1 hour)
  normalize?: boolean;     // default: true — enable model name normalization
})
```

### `ModelNormalizer`

```typescript
import { ModelNormalizer } from '@reaatech/agent-budget-pricing';

const normalizer = new ModelNormalizer();
normalizer.registerAlias('anthropic', 'claude-3-opus', 'claude-opus-4-1');
normalizer.normalize('claude-3-opus', 'anthropic'); // → "claude-opus-4-1"
```

### Built-in Pricing Tables

#### Anthropic

| Model            | Input (per 1M tokens) | Output (per 1M tokens) |
| ---------------- | --------------------- | ---------------------- |
| Claude Opus 4-1  | $15.00                | $75.00                 |
| Claude Sonnet 4  | $3.00                 | $15.00                 |
| Claude Haiku 3.5 | $0.25                 | $1.25                  |

#### OpenAI

| Model       | Input (per 1M tokens) | Output (per 1M tokens) |
| ----------- | --------------------- | ---------------------- |
| GPT-4       | $30.00                | $60.00                 |
| GPT-4 Turbo | $10.00                | $30.00                 |
| GPT-4 Mini  | $0.15                 | $0.60                  |
| o1          | $15.00                | $60.00                 |
| o3          | $15.00                | $60.00                 |

#### Google Gemini

| Model            | Input (per 1M tokens) | Output (per 1M tokens) |
| ---------------- | --------------------- | ---------------------- |
| Gemini 2.0 Flash | $0.10                 | $0.40                  |
| Gemini 2.0 Pro   | $1.25                 | $5.00                  |

#### AWS Bedrock

| Model           | Input (per 1M tokens) | Output (per 1M tokens) |
| --------------- | --------------------- | ---------------------- |
| Claude 3 Sonnet | $3.00                 | $15.00                 |
| Claude 3 Haiku  | $0.25                 | $1.25                  |
| Llama 3 70B     | $0.50                 | $0.70                  |
| Mistral Large   | $4.00                 | $12.00                 |

## Usage Patterns

### Custom Pricing Tables

```typescript
import { PricingEngine } from '@reaatech/agent-budget-pricing';

const pricing = new PricingEngine();
pricing.loadTable('my-provider', {
  'my-model-v1': { inputPricePerMillion: 1.5, outputPricePerMillion: 5.0 },
  'my-model-v2': { inputPricePerMillion: 2.0, outputPricePerMillion: 8.0 },
});

const cost = pricing.computeCost(1000, 500, 'my-model-v1', 'my-provider');
```

### Integration with Budget Check

```typescript
import { PricingEngine } from '@reaatech/agent-budget-pricing';
import { BudgetController } from '@reaatech/agent-budget-engine';

const pricing = new PricingEngine();
const controller = new BudgetController({ spendTracker, pricing });

// BudgetController uses pricing.estimateCost() for pre-flight checks
const result = await controller.check({
  scopeType: BudgetScope.User,
  scopeKey: 'user-42',
  estimatedCost: pricing.estimateCost('claude-opus-4-1', 2000, 'anthropic'),
  modelId: 'claude-opus-4-1',
});
```

## Related Packages

- [`@reaatech/agent-budget-types`](https://www.npmjs.com/package/@reaatech/agent-budget-types) — Core types (BudgetScope, SpendEntry)
- [`@reaatech/agent-budget-engine`](https://www.npmjs.com/package/@reaatech/agent-budget-engine) — Enforcement engine
- [`@reaatech/agent-budget-spend-tracker`](https://www.npmjs.com/package/@reaatech/agent-budget-spend-tracker) — Spend tracking

## License

[MIT](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE)
