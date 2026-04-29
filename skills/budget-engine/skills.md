# Budget Engine Skills

## Description

Build the core budget enforcement engine: policy evaluation, state machines, downgrade logic, tool filtering, and event emission.

## Skills

### `budget-engine:create-controller`

Create the BudgetController orchestrator.

**Parameters:**

- None

**Usage:**

```bash
agent invoke budget-engine:create-controller
```

**Creates:**

- `BudgetController` class with injectable dependencies (spendTracker, pricingEngine)
- `defineBudget(definition)` — register a budget
- `undefineBudget(scopeType, scopeKey)` — remove a budget
- `getBudget(scopeType, scopeKey)` — retrieve a budget definition

---

### `budget-engine:implement-check`

Implement the pre-request budget check.

**Parameters:**

- None

**Usage:**

```bash
agent invoke budget-engine:implement-check
```

**Creates:**

- `check(request: BudgetCheckRequest): BudgetCheckResult` method
- Looks up scope state, evaluates against policy
- Returns allowed/denied, suggested model, disabled tools, warnings

---

### `budget-engine:implement-record`

Implement post-request spend recording.

**Parameters:**

- None

**Usage:**

```bash
agent invoke budget-engine:implement-record
```

**Creates:**

- `record(entry: SpendEntry)` method
- Updates BudgetState running totals
- Triggers threshold checks
- Emits events on state changes

---

### `budget-engine:create-state-machine`

Create per-scope state machine (active → warned → degraded → stopped).

**Parameters:**

- None

**Usage:**

```bash
agent invoke budget-engine:create-state-machine
```

**Creates:**

- State machine implementation with transitions:
  - `active` → `warned` (soft cap crossed)
  - `warned` → `degraded` (auto-downgrade triggered)
  - `degraded` → `stopped` (hard cap crossed)
  - Any → `active` (budget reset)
- `getState(scope)` and `setState(scope, newState, reason)` methods

---

### `budget-engine:create-policy-evaluator`

Create PolicyEvaluator for soft/hard cap evaluation.

**Parameters:**

- None

**Usage:**

```bash
agent invoke budget-engine:create-policy-evaluator
```

**Creates:**

- `PolicyEvaluator` class
- `evaluate(spent, limit, policy)` — returns breach info
- Supports multiple thresholds (e.g., 50%, 75%, 90%, 100%)
- Returns list of triggered thresholds

---

### `budget-engine:create-downgrade-engine`

Create DowngradeEngine for model tier swapping.

**Parameters:**

- None

**Usage:**

```bash
agent invoke budget-engine:create-downgrade-engine
```

**Creates:**

- `DowngradeEngine` class
- `suggestDowngrade(currentModel, policy)` — follows downgrade chain
- `getDowngradeChain(policy)` — returns full downgrade path
- Supports wildcard `from: ['*']` for "all premium models"

---

### `budget-engine:create-tool-filter`

Create ToolFilter for expensive tool removal.

**Parameters:**

- None

**Usage:**

```bash
agent invoke budget-engine:create-tool-filter
```

**Creates:**

- `ToolFilter` class
- `filter(tools, policy)` — removes tools listed in policy.disableTools
- `getDisabledTools(policy)` — returns list of disabled tool names
- `ToolFilterResult` with original and filtered tool lists

---

### `budget-engine:add-event-emitter`

Add event emitter for budget lifecycle events.

**Parameters:**

- None

**Usage:**

```bash
agent invoke budget-engine:add-event-emitter
```

**Creates:**

- Extends BudgetController with EventEmitter
- Events: `threshold-breach`, `state-change`, `hard-stop`, `model-downgrade`, `tools-disabled`, `budget-reset`
- Each event includes scope, timestamp, and relevant metadata
- `on(event, listener)` and `off(event, listener)` methods

---

### `budget-engine:add-reset-scheduler`

Implement budget reset scheduling (cron-based and daily).

**Parameters:**

- None

**Usage:**

```bash
agent invoke budget-engine:add-reset-scheduler
```

**Creates:**

- `scheduleReset(scope, cronExpression)` method
- Daily midnight UTC reset (default)
- Custom cron expression support
- `reset(scope)` — manual reset
- Emits `budget-reset` event on reset

---

### `budget-engine:add-wildcard-budgets`

Support wildcard budget definitions (e.g., all users get $10/day).

**Parameters:**

- None

**Usage:**

```bash
agent invoke budget-engine:add-wildcard-budgets
```

**Creates:**

- Wildcard matching in `defineBudget` (scopeKey: `'*'`)
- `resolveBudget(scopeType, scopeKey)` — matches exact key first, then wildcard
- Default budget support (fallback when no match)

## Dependencies

- `types-development:define-budget-policy`
- `types-development:define-enforcement-actions`
- `types-development:define-downgrade-rules`
- `spend-tracker:create-store`
- `pricing-engine:build-lookup-engine`
- `project-setup:add-package` (must create `packages/engine/` first)

## Tests

- Test state machine transitions
- Test soft cap → warn, hard cap → stop
- Test downgrade chain traversal
- Test tool filtering
- Test event emission on threshold breach
- Test wildcard budget matching
- Test cron-based reset
- Test concurrent access to same scope
