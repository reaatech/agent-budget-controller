# LLM Router Plugin Skills

## Description

Integrate with llm-router as a pluggable RoutingStrategy for budget-aware model selection and auto-downgrade.

## Skills

### `llm-router-plugin:implement-strategy`

Implement the RoutingStrategy interface from llm-router.

**Parameters:**

- None

**Usage:**

```bash
agent invoke llm-router-plugin:implement-strategy
```

**Creates:**

- `BudgetAwareStrategy` class implementing `RoutingStrategy`
- `name: 'budget-aware'`
- `priority: 1` (highest priority, runs before all other strategies)
- `applies()` — always returns true (budget check applies to all requests)
- `select()` — filters models by budget, applies downgrade, returns selection

---

### `llm-router-plugin:add-budget-filtering`

Add budget-based model filtering.

**Parameters:**

- None

**Usage:**

```bash
agent invoke llm-router-plugin:add-budget-filtering
```

**Creates:**

- `filterByBudget(availableModels, remainingBudget)` method
- Removes models whose estimated cost exceeds remaining budget
- Estimates cost using model price × typical token ratio
- Returns filtered model list

---

### `llm-router-plugin:add-downgrade-integration`

Hook into llm-router fallback chains for auto-downgrade.

**Parameters:**

- None

**Usage:**

```bash
agent invoke llm-router-plugin:add-downgrade-integration
```

**Creates:**

- Fallback chain truncation when budget threshold crossed
- Modifies fallback chain to only include downgraded tier models
- Integrates with llm-router's `FallbackChainDefinition`
- Emits downgrade event to budget controller

---

### `llm-router-plugin:add-cost-telemetry-export`

Export cost telemetry back to llm-router's CostTracker.

**Parameters:**

- None

**Usage:**

```bash
agent invoke llm-router-plugin:add-cost-telemetry-export
```

**Creates:**

- Cost recording back to llm-router after model execution
- Syncs spend data between both systems
- `exportCost(result, budgetContext)` method
- Bidirectional cost tracking

---

### `llm-router-plugin:add-scope-resolution`

Add scope resolution from routing request context.

**Parameters:**

- None

**Usage:**

```bash
agent invoke llm-router-plugin:add-scope-resolution
```

**Creates:**

- Scope extraction from routing request metadata
- Header-based scope resolution (x-user-id, x-task-id, x-session-id)
- Budget ID mapping to scope
- Default scope fallback

---

### `llm-router-plugin:add-yaml-config`

Create YAML config section for llm-router.config.yaml integration.

**Parameters:**

- None

**Usage:**

```bash
agent invoke llm-router-plugin:add-yaml-config
```

**Creates:**

- Config schema for budget-aware strategy:
  ```yaml
  strategies:
    - name: budget-aware
      priority: 1
      config:
        default_scope_type: 'user'
        scope_header: 'x-user-id'
        controller_url: 'http://localhost:3001' # optional, for remote controller
  ```
- `BudgetRouterPluginConfig` Zod schema
- Config loader and validator

---

### `llm-router-plugin:create-plugin-factory`

Create the createBudgetRouterPlugin factory function.

**Parameters:**

- None

**Usage:**

```bash
agent invoke llm-router-plugin:create-plugin-factory
```

**Creates:**

- `createBudgetRouterPlugin(options)` factory
- Options: `controller`, `spendTracker`, `config`
- Returns `{ strategy, configSchema, hooks }`
- `hooks.preRouting` and `hooks.postExecution` for telemetry sync

## Dependencies

- `types-development:define-budget-scope`
- `types-development:define-enforcement-actions`
- `budget-engine:create-controller`
- `budget-engine:implement-check`
- `project-setup:add-package` (must create `packages/llm-router-plugin/` first)

## Tests

- Test strategy selection with budget constraints
- Test model filtering by remaining budget
- Test downgrade integration with fallback chains
- Test scope resolution from request headers
- Contract test with llm-router (sibling repo): verify RoutingStrategy interface compatibility
- Integration test: full routing pipeline with budget enforcement
