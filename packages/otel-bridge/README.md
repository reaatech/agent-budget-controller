# @reaatech/agent-budget-otel-bridge

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-budget-otel-bridge.svg)](https://www.npmjs.com/package/@reaatech/agent-budget-otel-bridge)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-budget-controller/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-budget-controller/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

OpenTelemetry span-to-spend bridge that converts GenAI spans into budget-tracked spend entries in real time. Drop it into any OTel-instrumented agent and every LLM call is automatically recorded against your budgets — no manual `record()` calls needed.

## Installation

```bash
npm install @reaatech/agent-budget-otel-bridge
# or
pnpm add @reaatech/agent-budget-otel-bridge
```

## Feature Overview

- **Automatic spend recording** — every GenAI span becomes a `SpendEntry` pushed to the `BudgetController`
- **OTel GenAI attribute extraction** — reads `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.request.model`, `gen_ai.system`, `llm.cost.total_usd`
- **Custom scope extraction** — supply your own `scopeExtractor` to map spans to budget scopes
- **Default scope extractor** — reads `budget.scope_type` and `budget.scope_key` from span attributes
- **Non-blocking** — span processing is fire-and-forget; the bridge never adds latency to your agent
- **Optional peer dependency** — `@opentelemetry/api` is optional; the bridge works with any OTel-compatible span data

## Quick Start

```typescript
import { SpanListener } from '@reaatech/agent-budget-otel-bridge';
import { BudgetController } from '@reaatech/agent-budget-engine';
import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import { BudgetScope } from '@reaatech/agent-budget-types';

const store = new SpendStore();
const controller = new BudgetController({ spendTracker: store });

const listener = new SpanListener({ controller });

// When an OTel span ends, feed it to the listener
function onSpanEnd(span: ReadableSpan) {
  listener.onSpanEnd(span.attributes);
}
```

### With an OTel Span Processor

```typescript
import { SpanListener } from '@reaatech/agent-budget-otel-bridge';
import { NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';

const listener = new SpanListener({ controller });
const provider = new NodeTracerProvider();

provider.addSpanProcessor({
  onEnd(span) {
    listener.onSpanEnd(span.attributes);
  },
  forceFlush: () => Promise.resolve(),
  shutdown: () => Promise.resolve(),
});
```

## API Reference

### `SpanListener`

| Method                              | Description                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `onSpanEnd(attributes, overrides?)` | Process span attributes and record a spend entry. Returns `true` if a spend entry was created. |

#### Constructor

```typescript
new SpanListener(options: {
  controller: BudgetController;
  scopeExtractor?: (attributes: Record<string, unknown>) => {
    scopeType: BudgetScope;
    scopeKey: string;
  } | null;
})
```

The default `scopeExtractor` reads these span attributes:

| Attribute           | Description                                 |
| ------------------- | ------------------------------------------- |
| `budget.scope_type` | `"task"`, `"user"`, `"session"`, or `"org"` |
| `budget.scope_key`  | The scope identifier (e.g., `"user-42"`)    |

The listener extracts these standard GenAI OTel attributes:

| Attribute                    | Used For              |
| ---------------------------- | --------------------- |
| `gen_ai.usage.input_tokens`  | Token count           |
| `gen_ai.usage.output_tokens` | Token count           |
| `gen_ai.request.model`       | Model ID              |
| `gen_ai.system`              | Provider name mapping |
| `llm.cost.total_usd`         | Recorded cost         |

## Usage Patterns

### Span Attribute Overrides

```typescript
listener.onSpanEnd(span.attributes, {
  cost: 0.15,
  modelId: 'claude-sonnet-4',
});
```

## Integration with OpenTelemetry SDK

```typescript
import { SpanListener } from '@reaatech/agent-budget-otel-bridge';
import { BudgetController } from '@reaatech/agent-budget-engine';
import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import { NodeTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const store = new SpendStore();
const controller = new BudgetController({ spendTracker: store });
const listener = new SpanListener({ controller });

await controller.defineBudget({
  scopeType: BudgetScope.User,
  scopeKey: 'user-42',
  limit: 10.0,
  policy: { softCap: 0.8, hardCap: 1.0 },
});

const provider = new NodeTracerProvider();
provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter()));
provider.addSpanProcessor({
  onEnd: (span) => listener.onSpanEnd(span.attributes),
  forceFlush: () => Promise.resolve(),
  shutdown: () => Promise.resolve(),
});
provider.register();
```

## Creating a Custom Scope Extractor

```typescript
const listener = new SpanListener({
  controller,
  scopeExtractor: (attributes) => {
    const userId = attributes['myapp.user_id'] as string;
    const orgId = attributes['myapp.org_id'] as string;

    if (userId) {
      return { scopeType: BudgetScope.User, scopeKey: userId };
    }
    if (orgId) {
      return { scopeType: BudgetScope.Org, scopeKey: orgId };
    }
    return null;
  },
});
```

## Related Packages

- [`@reaatech/agent-budget-types`](https://www.npmjs.com/package/@reaatech/agent-budget-types) — Core types (BudgetScope, SpendEntry)
- [`@reaatech/agent-budget-engine`](https://www.npmjs.com/package/@reaatech/agent-budget-engine) — Enforcement engine
- [`@reaatech/agent-budget-spend-tracker`](https://www.npmjs.com/package/@reaatech/agent-budget-spend-tracker) — Spend tracking
- [`@reaatech/agent-budget-middleware`](https://www.npmjs.com/package/@reaatech/agent-budget-middleware) — HTTP middleware wrapper
- [`@reaatech/agent-budget-pricing`](https://www.npmjs.com/package/@reaatech/agent-budget-pricing) — LLM pricing tables

## License

[MIT](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE)
