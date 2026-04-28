# OTel Bridge Skills

## Description

Bridge integration with @otel-cost-exporter to consume cost metrics and GenAI spans in real-time, converting them to SpendEntry records.

## Skills

### `otel-bridge:create-span-listener`

Create span listener that converts GenAI spans to SpendEntry.

**Parameters:**

- None

**Usage:**

```bash
agent invoke otel-bridge:create-span-listener
```

**Creates:**

- `SpanListener` class implementing OTel span processor interface
- Extracts GenAI attributes: model, input/output tokens, provider
- Maps span attributes to SpendEntry format
- Handles both GenAI semantic conventions v0.28+ and v1.x

---

### `otel-bridge:create-metric-receiver`

Create OTLP metric receiver (HTTP/gRPC).

**Parameters:**

- `protocol` (optional): Protocol type (`http` or `grpc`, default: `http`)
- `port` (optional): Listen port (default: `4319`)

**Usage:**

```bash
agent invoke otel-bridge:create-metric-receiver --protocol http --port 4318
```

**Creates:**

- `MetricReceiver` class
- OTLP/HTTP endpoint for receiving cost metrics
- Default port `4319` to avoid conflict with standard OTel Collector (`4318`)
- Subscribes to `llm.cost.*` metrics from @otel-cost-exporter
- Converts metrics to SpendEntry and records to SpendTracker
- Note: This is a secondary mode. Primary mode is direct span-processor subscription.

---

### `otel-bridge:add-scope-extraction`

Add scope extraction from span attributes.

**Parameters:**

- None

**Usage:**

```bash
agent invoke otel-bridge:add-scope-extraction
```

**Creates:**

- Scope attribute extraction: `budget.scope_type`, `budget.scope_key`
- Fallback to span resource attributes
- Default scope resolution (org/default)
- `ScopeExtractor` interface for custom extraction

---

### `otel-bridge:add-push-recording`

Implement push-based spend recording (as spans arrive).

**Parameters:**

- None

**Usage:**

```bash
agent invoke otel-bridge:add-push-recording
```

**Creates:**

- Real-time span processing pipeline
- Immediate SpendTracker.record() on span arrival
- Batch processing support (configurable batch size and flush interval)
- Backpressure handling

---

### `otel-bridge:add-pull-queries`

Implement pull-based spend queries (on-demand checks).

**Parameters:**

- None

**Usage:**

```bash
agent invoke otel-bridge:add-pull-queries
```

**Creates:**

- `getSpend(scope)` — query current spend from tracker
- `getSpendByTimeRange(scope, start, end)` — historical query
- `getMetrics(scope)` — aggregated metrics

---

### `otel-bridge:add-reconnection-handling`

Add reconnection and local buffering for OTel connection failures.

**Parameters:**

- `maxBuffer` (optional): Max buffered entries during disconnect (default: `10000`)

**Usage:**

```bash
agent invoke otel-bridge:add-reconnection-handling --maxBuffer 10000
```

**Creates:**

- Connection health monitoring
- Local buffer for spans during disconnect
- Automatic replay on reconnect
- Exponential backoff for reconnection attempts

---

### `otel-bridge:add-cost-exporter-subscription`

Subscribe to @otel-cost-exporter/core cost metrics.

**Parameters:**

- None

**Usage:**

```bash
agent invoke otel-bridge:add-cost-exporter-subscription
```

**Creates:**

- Metric subscription for:
  - `llm.cost.input_tokens_usd`
  - `llm.cost.output_tokens_usd`
  - `llm.cost.total_usd`
- Metric label extraction (model, provider, service)
- Cost aggregation by scope

---

### `otel-bridge:create-bridge-factory`

Create the createOTelBridge factory function.

**Parameters:**

- None

**Usage:**

```bash
agent invoke otel-bridge:create-bridge-factory
```

**Creates:**

- `createOTelBridge(options)` factory
- Options: `controller`, `spendTracker`, `scopeExtractor`, `protocol`, `port`
- `start()` and `stop()` lifecycle methods
- Integrates all bridge components

## Dependencies

- `types-development:define-spend-entry`
- `spend-tracker:create-store`
- `budget-engine:create-controller`
- `project-setup:add-package` (must create `packages/otel-bridge/` first)

## Tests

- Test span-to-SpendEntry conversion
- Test OTLP metric receiver (mock OTLP client)
- Test scope extraction from span attributes
- Test buffering during disconnect
- Test replay on reconnect
- Integration test with @otel-cost-exporter (sibling repo)
- Contract test: verify metric name/label compatibility
