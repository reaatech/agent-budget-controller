# Architecture

## System Overview

The Agent Budget Controller is a real-time cost enforcement layer for LLM agent systems. It sits between the agent orchestration layer and the LLM provider APIs, intercepting every request to check spend against configurable budgets and applying enforcement actions when thresholds are breached.

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Agent App     │───▶│  Budget Controller   │───▶│   LLM Router        │
│                 │    │  (enforcement layer) │    │   (model selection) │
└─────────────────┘    └──────────────────────┘    └─────────────────────┘
                                │                            │
                                ▼                            ▼
                       ┌─────────────────┐         ┌─────────────────────┐
                       │  Spend Tracker  │         │   LLM Provider APIs │
                       │  (real-time)    │         │                     │
                       └─────────────────┘         └─────────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ OTel Cost       │
                       │ Exporter        │
                       │ (cost metrics)  │
                       └─────────────────┘
```

## Packages

### `@agent-budget-controller/types`

Core domain types and Zod schemas. No external dependencies beyond Zod.

**Key types:**

- `BudgetScope` — `task` | `user` | `session` | `org`
- `BudgetError` — base error class with `code` and `scope` properties
- `BudgetExceededError` — extends `BudgetError`, thrown on hard cap breach
- `BudgetValidationError` — extends `BudgetError`, thrown on invalid config
- `BudgetPolicy` — `{ softCap: number; hardCap: number; autoDowngrade: DowngradeRule[]; disableTools: string[] }`
- `EnforcementAction` — `allow` | `warn` | `degrade` | `disable-tools` | `hard-stop`
- `SpendEntry` — `{ requestId, scopeType, scopeKey, cost, inputTokens, outputTokens, modelId, provider, timestamp, metadata }`
- `BudgetState` — running state per scope: `{ scopeType, scopeKey, limit, spent, remaining, policy, state: 'active'|'warned'|'degraded'|'stopped', lastThreshold, breachCount }`
- `DowngradeRule` — `{ from: string[]; to: string }` (e.g., `from: ['claude-opus-4-1'], to: 'claude-sonnet-4' }`)
- `ToolCostConfig` — `{ toolName: string; costWeight: number }` — expensive tools cost more against budget
- `BudgetError` / `BudgetExceededError` / `BudgetValidationError` — structured error types for all packages

### `@agent-budget-controller/pricing`

Pricing table management. Loads default pricing tables for major providers and supports file-based overrides.

**Key classes:**

- `PricingEngine` — `lookup(modelId, provider)` → `{ inputPricePerMillion, outputPricePerMillion }`
- `ModelNormalizer` — maps provider-specific model names to canonical forms
- `PricingCache` — LRU cache (default TTL: 1 hour) for price lookups

**Pricing tables included:**

- Anthropic (Claude Opus, Sonnet, Haiku)
- OpenAI (GPT-4, GPT-4 Mini, O1, O3)
- Google (Gemini Pro, Flash)
- AWS Bedrock (Claude, Llama, Mistral via Bedrock)

### `@agent-budget-controller/spend-tracker`

Real-time spend tracking with sub-millisecond lookups. Uses in-memory storage with sliding windows.

**Key classes:**

- `SpendStore` — append-only store with configurable max entries (default 500K), circular buffer with multi-index structure (by scope key, by time bucket, by model)

**Key methods:**

```typescript
// Record a spend entry
tracker.record(entry: SpendEntry): void

// Get current spend for a scope (O(1))
tracker.getSpend(scopeType, scopeKey): number

// Get spend rate (USD/minute)
tracker.getRate(scopeType, scopeKey): number

// Project total spend based on current rate
tracker.projectTotal(scopeType, scopeKey, windowHours: number): number

// Detect spend anomalies
tracker.detectSpikes(scopeType, scopeKey, threshold?: number): SpikeAlert[]
```

**Data structure:**

```
SpendStore
├── entries[]           // circular buffer of SpendEntry
├── byScope             // Map<scopeType:scopeKey, SpendAccumulator>
│   └── SpendAccumulator
│       ├── total       // running total (O(1) lookup)
│       └── entryIds[]  // indices into entries[]
├── byTimeBucket        // Map<minute-bucket, Set<entryId>>
└── byModel             // Map<modelId, Set<entryId>>
```

### `@agent-budget-controller/budget-engine`

The core enforcement engine. Evaluates budgets, applies policies, and emits enforcement decisions.

**Key classes:**

- `BudgetController` — central orchestrator
- `PolicyEvaluator` — evaluates a scope against its policy
- `DowngradeEngine` — selects downgrade targets
- `ToolFilter` — determines which tools to disable

**State machine per scope:**

```
                    ┌──────────┐
             ┌─────▶│  active  │◀──────┐
             │      └────┬─────┘       │
             │           │             │
             │     soft cap reached    │
             │           │             │
             │      ┌────▼─────┐       │
             │      │  warned  │       │
             │      └────┬─────┘       │
             │           │             │
             │   auto-downgrade        │  budget reset
             │   triggered             │  (new day / manual)
             │           │             │
             │      ┌────▼──────┐      │
             │      │  degraded │──────┘
             │      └────┬──────┘
             │           │
             │     hard cap reached
             │           │
             │      ┌────▼──────┐
             └──────│  stopped  │
                    └───────────┘
```

**Key methods:**

```typescript
// Define a budget
controller.defineBudget({
  scopeType: BudgetScope.User,
  scopeKey: 'user-123',
  limit: 10.0, // USD
  policy: {
    softCap: 0.8, // warn at 80%
    hardCap: 1.0, // stop at 100%
    autoDowngrade: [
      { from: ['claude-opus-4-1'], to: 'claude-sonnet-4' },
      { from: ['claude-sonnet-4'], to: 'claude-haiku-3-5' },
    ],
    disableTools: ['web-search', 'file-read'],
  },
});

// Check before a request
const result = controller.check({
  scopeType: BudgetScope.User,
  scopeKey: 'user-123',
  estimatedCost: 0.05,
  modelId: 'claude-opus-4-1',
  tools: ['web-search', 'code-exec'],
});
// → {
//   allowed: true,
//   action: 'degrade',
//   suggestedModel: 'claude-sonnet-4',
//   disabledTools: ['web-search'],
//   remaining: 1.95,
//   warning: 'Approaching soft cap (82% spent)',
// }

// Record actual spend after request
controller.record({
  requestId: 'req-abc123',
  scopeType: BudgetScope.User,
  scopeKey: 'user-123',
  cost: 0.042,
  inputTokens: 2500,
  outputTokens: 800,
  modelId: 'claude-sonnet-4',
  provider: 'anthropic',
  timestamp: new Date(),
});
```

**Event emitter:**

```typescript
controller.on('threshold-breach', (event) => {
  // { scope, threshold, spent, limit, action, timestamp }
});
controller.on('state-change', (event) => {
  // { scope, from: 'warned', to: 'degraded', reason, timestamp }
});
controller.on('hard-stop', (event) => {
  // { scopeType, scopeKey, spent, limit, timestamp }
});
```

### `@agent-budget-controller/middleware`

HTTP middleware and SDK wrapper for integrating budget enforcement into agent applications.

**SDK wrapper (for agent loops):**

```typescript
import { BudgetInterceptor } from '@agent-budget-controller/middleware';
import { BudgetScope } from '@agent-budget-controller/types';

const interceptor = new BudgetInterceptor({ controller });

// Before agent step
const context = interceptor.beforeStep({
  scope: { scopeType: BudgetScope.Task, scopeKey: taskId },
  modelId: 'claude-opus-4-1',
  tools,
});

// After agent step
interceptor.afterStep({
  ...context,
  actualCost,
  inputTokens,
  outputTokens,
  requestId: 'req-abc123',
});
```

**HTTP middleware utility (`createBudgetMiddleware`):**

```typescript
import { createBudgetMiddleware } from '@agent-budget-controller/middleware';

const budgetMiddleware = createBudgetMiddleware({ controller });

const mw = budgetMiddleware({
  headers: {
    'x-budget-scope-type': 'user',
    'x-budget-scope-key': 'user-123',
  },
});

const ctx = mw.beforeStep({ modelId: 'claude-opus-4-1', tools: [], estimatedCost: 0.05 });
mw.afterStep({ actualCost: 0.05, inputTokens: 1000, outputTokens: 500, requestId: 'req-1' });
```

Full Express/Fastify middleware with response header injection is planned for a future release.

### `@agent-budget-controller/otel-bridge`

Bridges OpenTelemetry GenAI spans to budget spend recording. Supports direct
span attribute ingestion and custom scope extraction.

```typescript
import { SpanListener } from '@agent-budget-controller/otel-bridge';

const listener = new SpanListener({
  controller: budgetController,
});

// When a GenAI span completes
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

Uses `@opentelemetry/api` as an optional peer dependency for OTel attribute conventions.

### `@agent-budget-controller/llm-router-plugin`

Integrates with the `llm-router` package as a pluggable routing strategy.

```typescript
import { BudgetAwareStrategy } from '@agent-budget-controller/llm-router-plugin';

const strategy = new BudgetAwareStrategy({
  controller: budgetController,
  defaultScopeType: BudgetScope.User,
});

const result = strategy.select({
  scopeKey: 'user-123',
  models: [
    { id: 'claude-opus-4-1', estimatedCost: 0.1 },
    { id: 'claude-sonnet-4', estimatedCost: 0.03 },
  ],
});
```

**How it works:**

1. Before routing, queries budget controller for remaining budget
2. Filters available models to those whose estimated cost fits within remaining budget
3. If no models fit, returns `hard-stop` decision
4. If current model is above soft cap, applies downgrade rules
5. Passes filtered model list to next strategy in priority chain

**Integration with fallback chains:**

The plugin hooks into llm-router's fallback chain execution. When a budget threshold is crossed mid-chain, it truncates the chain to only include models within the downgraded tier.

### `@agent-budget-controller/cli`

Command-line interface for budget management and diagnostics.

```bash
# Check remaining budget
agent-budget check --scope user:user-123

# List all active budgets
agent-budget list

# Generate spend report
agent-budget report --scope user:user-123 --period 24h --format json

# Set a budget
agent-budget set --scope user:user-456 --limit 5.00 --soft-cap 0.80 --hard-cap 1.00

# Reset a budget
agent-budget reset --scope user:user-123

# Validate config
agent-budget validate-config --config agent-budget.yaml

# Simulate a request
agent-budget simulate --scope user:user-123 --model claude-opus-4-1 --input-tokens 5000 --output-tokens 2000
```

## Data Flow

### Request Flow

```
1. Agent receives request
2. Pre-request hook fires
   ├─ Extract scope (task/user/session/org)
   ├─ Estimate cost (tokens × model price) — best effort
   ├─ BudgetController.check(scope, estimatedCost)
   │  ├─ Look up BudgetState for scope
   │  ├─ Evaluate policy thresholds
   │  ├─ Determine enforcement action
   │  └─ Return BudgetCheckResult
   └─ Apply enforcement:
      ├─ allow → proceed
      ├─ warn → proceed + emit warning
      ├─ degrade → swap model, proceed
      ├─ disable-tools → filter tools, proceed
      └─ hard-stop → reject request

   Note: Pre-request checks are advisory. If estimatedCost is unknown
   (zero), the check cannot block on spend alone. Model downgrade and
   tool filtering still apply based on current state.

3. LLM request executes (possibly with downgraded model / filtered tools)

4. Post-request hook fires
   ├─ Calculate actual cost (actual tokens × model price)
   ├─ BudgetController.record(scope, actualCost)
   ├─ SpendTracker.record(SpendEntry)
   └─ Check for threshold breaches → emit events

   Note: Hard cap enforcement takes effect on the *subsequent* request
   after record() pushes spend over the hard cap.
```

### OTel Integration Flow

```
LLM App → OTel SDK → Span Exporter
                        │
                        ▼
              @otel-cost-exporter/core
                        │
                        ▼
         [Cost calculated from GenAI span]
                        │
                        ▼
        agent-budget-controller/otel-bridge
                        │
                        ▼
              SpendTracker.record()
                        │
                        ▼
              BudgetController.check thresholds
                        │
                        ▼
              Emit events / enforce actions
```

### LLM Router Integration Flow

```
Agent Request
      │
      ▼
llm-router (entry point)
      │
      ▼
budget-aware strategy (priority 1)
      │
      ├─ Query BudgetController
      │
      ├─ Filter models by budget
      │
      ├─ Apply downgrade rules
      │
      └─ Pass filtered models to next strategy
              │
              ▼
      cost-optimized strategy (priority 5)
              │
              ▼
      Selected model
              │
              ▼
      Execute with fallback chain
              │
              ▼
      Record cost back to BudgetController
```

## Configuration

### Budget Definition (JSON)

```json
{
  "scopeType": "user",
  "scopeKey": "*",
  "limit": 10.0,
  "policy": {
    "softCap": 0.8,
    "hardCap": 1.0,
    "autoDowngrade": [
      { "from": ["claude-opus-4-1"], "to": "claude-sonnet-4" },
      { "from": ["claude-sonnet-4"], "to": "claude-haiku-3-5" }
    ],
    "disableTools": ["web-search", "code-exec"]
  }
}
```

Configuration is done programmatically via `controller.defineBudget()` or via JSON piped to the CLI. YAML configuration file support and cron-based automatic budget resets are planned for a future release.

### Scope Resolution

Scopes are resolved via configurable extractors:

```typescript
// Express middleware
const scopeResolver = (req, res) => {
  // Return first matching scope
  if (req.headers['x-task-id']) {
    return { scopeType: 'task', scopeKey: req.headers['x-task-id'] };
  }
  if (req.headers['x-user-id']) {
    return { scopeType: 'user', scopeKey: req.headers['x-user-id'] };
  }
  if (req.headers['x-session-id']) {
    return { scopeType: 'session', scopeKey: req.headers['x-session-id'] };
  }
  return { scopeType: 'org', scopeKey: 'default' };
};
```

## Deployment Modes

### In-Process (Single Node.js Process)

All components run within a single Node.js process. The default `SpendStore` is
in-memory with a circular buffer. This is the simplest and highest-performance
deployment — budget checks are sub-millisecond with zero network overhead.

### Multi-Process / Containerized

**Limitation:** The default in-memory `SpendStore` does not share state across
processes. If you run multiple Node.js workers or containers, each instance
maintains its own spend view. A request hitting worker A will not see spend
recorded by worker B.

**Mitigation:** For distributed deployments, an external state backend (e.g.,
Redis) is required. This is planned for a future v2 release. Until then,
distributed deployments should either:

- Pin all requests for a given scope to the same worker (sticky sessions), or
- Accept that budget enforcement is eventually consistent across workers.

## Observability

The `BudgetController` emits typed events for all state transitions and threshold breaches:

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

OpenTelemetry metrics emission and structured logging (pino) are planned for a future release.

## Security

1. **Budget isolation** — scopes cannot access other scopes' data
2. **API key protection** — pricing data and budget configs never exposed in API responses

## Failure Modes

| Failure                       | Detection                 | Recovery                                                     |
| ----------------------------- | ------------------------- | ------------------------------------------------------------ |
| Spend tracker memory overflow | Entry count > maxEntries  | Circular buffer eviction (oldest first)                      |
| Budget controller crash       | Health check fails        | Restart with persisted state from spend store                |
| Price lookup failure          | Cache miss + lookup error | Use cached price, log warning, fall back to provider default |
| Clock skew (reset timing)     | Reset check fails         | Use UTC midnight as canonical reset time                     |

## Integration Examples

### Standalone (no otel-cost-exporter, no llm-router)

```typescript
import { BudgetController } from '@agent-budget-controller/budget-engine';
import { SpendStore } from '@agent-budget-controller/spend-tracker';
import { BudgetInterceptor } from '@agent-budget-controller/middleware';
import { BudgetScope } from '@agent-budget-controller/types';

const spendTracker = new SpendStore({ maxEntries: 500000 });
const controller = new BudgetController({ spendTracker });

controller.defineBudget({
  scopeType: BudgetScope.User,
  scopeKey: 'user-123',
  limit: 10.00,
  policy: { softCap: 0.80, hardCap: 1.00, autoDowngrade: [...] },
});

const interceptor = new BudgetInterceptor({ controller });

const ctx = interceptor.beforeStep({
  scope: { scopeType: BudgetScope.User, scopeKey: 'user-123' },
  modelId: 'claude-opus-4-1',
  tools,
});
const response = await callLLM(ctx.modelId, ctx.tools);
interceptor.afterStep({
  ...ctx,
  actualCost: response.cost,
  inputTokens: response.inputTokens,
  outputTokens: response.outputTokens,
  requestId: 'req-abc123',
});
```

### With otel-cost-exporter

```typescript
import { SpanListener } from '@agent-budget-controller/otel-bridge';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { CostSpanProcessor } from '@otel-cost-exporter/core';

const listener = new SpanListener({ controller });

// In your CostSpanProcessor or span exporter callback:
// listener.onSpanEnd(spanAttributes, { requestId: span.spanContext().spanId });
```

### With llm-router

```yaml
# llm-router.config.yaml
strategies:
  - name: budget-aware
    priority: 1
    config:
      default_scope_type: 'user'
      scope_header: 'x-user-id'
```

```typescript
import { BudgetAwareStrategy } from '@agent-budget-controller/llm-router-plugin';

const strategy = new BudgetAwareStrategy({ controller, defaultScopeType: 'user' });
// Register strategy in your llm-router at priority 1
```
