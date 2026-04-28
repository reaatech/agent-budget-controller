# Testing & QA Skills

## Description

Comprehensive testing across all packages: unit tests, integration tests, contract tests, performance tests, and memory leak detection.

## Skills

### `testing-qa:write-unit-tests`

Write unit tests for all packages with Vitest.

**Parameters:**

- `package` (optional): Specific package to test (default: `all`)
- `coverageThreshold` (optional): Coverage threshold (default: `90`)

**Usage:**

```bash
agent invoke testing-qa:write-unit-tests --package budget-engine
```

**Creates:**

- Unit tests for each package in `packages/<name>/tests/unit/`
- Test factories and fixtures
- Mock implementations for external dependencies
- 90%+ coverage target

---

### `testing-qa:create-integration-tests`

Create integration tests for spend tracker + budget engine + middleware.

**Parameters:**

- None

**Usage:**

```bash
agent invoke testing-qa:create-integration-tests
```

**Creates:**

- Integration test suite in `tests/integration/`
- Full request lifecycle tests (check → record → enforce)
- Multi-scope isolation tests
- State machine transition tests
- Middleware end-to-end tests (Express app with budget enforcement)

---

### `testing-qa:build-otel-contract-tests`

Build contract tests for otel-cost-exporter integration.

**Parameters:**

- None

**Usage:**

```bash
agent invoke testing-qa:build-otel-contract-tests
```

**Creates:**

- Contract tests in `tests/contract/otel/`
- Verifies span attribute compatibility with @otel-cost-exporter
- Tests metric name/label format compatibility
- Tests OTLP protocol compatibility
- Uses @otel-cost-exporter from sibling repo (`../otel-cost-exporter`)

---

### `testing-qa:build-router-contract-tests`

Build contract tests for llm-router integration.

**Parameters:**

- None

**Usage:**

```bash
agent invoke testing-qa:build-router-contract-tests
```

**Creates:**

- Contract tests in `tests/contract/llm-router/`
- Verifies RoutingStrategy interface compatibility
- Tests fallback chain integration
- Tests cost telemetry sync
- Uses llm-router from sibling repo (`../llm-router`)

---

### `testing-qa:write-performance-tests`

Write performance tests for concurrent scope checks.

**Parameters:**

- `concurrency` (optional): Concurrent check count (default: `10000`)

**Usage:**

```bash
agent invoke testing-qa:write-performance-tests --concurrency 10000
```

**Creates:**

- Performance test suite in `tests/performance/`
- 10K concurrent scope check test
- Budget check latency benchmark (target: p99 < 1ms)
- Spend recording throughput test
- Memory usage under load test

---

### `testing-qa:implement-memory-leak-tests`

Implement memory leak tests for long-running spend tracking.

**Parameters:**

- None

**Usage:**

```bash
agent invoke testing-qa:implement-memory-leak-tests
```

**Creates:**

- Memory leak test suite in `tests/memory/`
- Long-running spend tracking (1M entries)
- Heap snapshot comparison
- Circular buffer eviction verification
- GC pressure measurement

---

### `testing-qa:create-test-fixtures`

Create test fixtures and factories.

**Parameters:**

- None

**Usage:**

```bash
agent invoke testing-qa:create-test-fixtures
```

**Creates:**

- `tests/fixtures/` directory with:
  - `budgets.ts` — budget definition factories
  - `spend-entries.ts` — spend entry factories
  - `models.ts` — model definition fixtures
  - `requests.ts` — routing request fixtures
  - `config.yaml` — test configuration file

---

### `testing-qa:setup-coverage`

Set up coverage reporting with Vitest.

**Parameters:**

- `threshold` (optional): Coverage threshold (default: `90`)

**Usage:**

```bash
agent invoke testing-qa:setup-coverage --threshold 90
```

**Creates:**

- Vitest coverage configuration
- Per-package coverage reports
- Combined monorepo coverage report
- Coverage badges for README

## Dependencies

None — testing skills can be applied after any development skill.

## Tests

Run `pnpm run test:coverage` to verify all tests pass and coverage thresholds are met.
