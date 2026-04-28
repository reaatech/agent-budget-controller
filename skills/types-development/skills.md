# Types Development Skills

## Description

Define all domain types, enums, interfaces, and Zod schemas for the agent-budget-controller system.

## Skills

### `types-development:define-budget-scope`

Create the BudgetScope enum and related types.

**Parameters:**

- `scopeTypes` (optional): Array of scope type strings (default: `['task', 'user', 'session', 'org']`)

**Usage:**

```bash
agent invoke types-development:define-budget-scope --scopeTypes '["task","user","session","org"]'
```

**Creates:**

- `BudgetScope` enum
- `ScopeIdentifier` interface (`{ scopeType: BudgetScope; scopeKey: string }`)
- `ScopeResolver` interface for extracting scopes from requests

---

### `types-development:define-budget-policy`

Create BudgetPolicy interface with Zod schema.

**Parameters:**

- `softCapDefault` (optional): Default soft cap ratio (default: `0.80`)
- `hardCapDefault` (optional): Default hard cap ratio (default: `1.00`)

**Usage:**

```bash
agent invoke types-development:define-budget-policy --softCapDefault 0.80
```

**Creates:**

- `BudgetPolicy` interface (`softCap`, `hardCap`, `autoDowngrade`, `disableTools`)
- `BudgetPolicySchema` (Zod)
- `BudgetDefinition` interface (full budget config)
- `BudgetDefinitionSchema` (Zod)

---

### `types-development:define-enforcement-actions`

Create EnforcementAction enum and state machine types.

**Parameters:**

- None

**Usage:**

```bash
agent invoke types-development:define-enforcement-actions
```

**Creates:**

- `EnforcementAction` enum (`allow`, `warn`, `degrade`, `disable-tools`, `hard-stop`)
- `BudgetStateEnum` (`active`, `warned`, `degraded`, `stopped`)
- `StateTransition` interface
- `EnforcementResult` interface

---

### `types-development:define-spend-entry`

Create SpendEntry and related tracking types.

**Parameters:**

- None

**Usage:**

```bash
agent invoke types-development:define-spend-entry
```

**Creates:**

- `SpendEntry` interface (`requestId`, `scopeType`, `scopeKey`, `cost`, `inputTokens`, `outputTokens`, `modelId`, `provider`, `timestamp`, `metadata`)
- `SpendEntrySchema` (Zod)
- `SpendQuery` interface for filtering entries

---

### `types-development:define-budget-state`

Create BudgetState runtime tracking types.

**Parameters:**

- None

**Usage:**

```bash
agent invoke types-development:define-budget-state
```

**Creates:**

- `BudgetState` interface (`scopeType`, `scopeKey`, `limit`, `spent`, `remaining`, `policy`, `state`, `lastThreshold`, `breachCount`, `lastReset`, `lastUpdated`)
- `BudgetStateSchema` (Zod)
- `BudgetSnapshot` interface for reporting

---

### `types-development:define-downgrade-rules`

Create DowngradeRule and model tier types.

**Parameters:**

- None

**Usage:**

```bash
agent invoke types-development:define-downgrade-rules
```

**Creates:**

- `DowngradeRule` interface (`from: string[]`, `to: string`)
- `ModelTier` enum (`premium`, `standard`, `economy`)
- `DowngradeChain` interface
- `DowngradeRuleSchema` (Zod)

---

### `types-development:define-tool-cost-config`

Create ToolCostConfig for expensive tool tracking.

**Parameters:**

- None

**Usage:**

```bash
agent invoke types-development:define-tool-cost-config
```

**Creates:**

- `ToolCostConfig` interface (`toolName`, `costWeight`)
- `ToolFilterResult` interface
- `ToolCostConfigSchema` (Zod)

---

### `types-development:define-error-types`

Create structured error types for the entire system.

**Parameters:**

- None

**Usage:**

```bash
agent invoke types-development:define-error-types
```

**Creates:**

- `BudgetError` class — base error with `code`, `scope`, `message`
- `BudgetExceededError` class — thrown when hard cap is breached
- `BudgetValidationError` class — thrown on invalid config or arguments
- All errors extend native `Error` and are serializable

---

### `types-development:define-check-result`

Create BudgetCheckResult and related response types.

**Parameters:**

- None

**Usage:**

```bash
agent invoke types-development:define-check-result
```

**Creates:**

- `BudgetCheckResult` interface (`allowed`, `action`, `remaining`, `limit`, `estimatedCost`, `suggestedModel`, `disabledTools`, `warning`, `reason`)
- `BudgetCheckRequest` interface
- `BudgetCheckResultSchema` (Zod)

---

### `types-development:export-barrel`

Create the barrel export file for the types package.

**Parameters:**

- None

**Usage:**

```bash
agent invoke types-development:export-barrel
```

**Creates:**

- `src/index.ts` with all exports

## Dependencies

- `project-setup:add-package` (must create `packages/types/` first)

## Tests

Run `pnpm run typecheck` in the types package. Zod schemas should validate against test fixtures.
