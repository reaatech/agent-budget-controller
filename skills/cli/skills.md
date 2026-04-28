# CLI Skills

## Description

Build a CLI with commander.js for budget management, diagnostics, and simulation.

## Skills

### `cli:create-base`

Create the CLI base with commander.js.

**Parameters:**

- None

**Usage:**

```bash
agent invoke cli:create-base
```

**Creates:**

- CLI entry point (`packages/cli/src/cli.ts`)
- Commander program with global options: `--config`, `--verbose`
- Config file loading (YAML/JSON)
- Structured logging setup

---

### `cli:add-check-command`

Implement `check` command for remaining budget queries.

**Parameters:**

- None

**Usage:**

```bash
agent invoke cli:add-check-command
```

**Creates:**

- `check <scope>` command
- Scope format: `type:key` (e.g., `user:user-123`)
- Output: remaining budget, limit, percentage used, state
- Options: `--format` (text/json/table)

---

### `cli:add-list-command`

Implement `list` command for all active budgets.

**Parameters:**

- None

**Usage:**

```bash
agent invoke cli:add-list-command
```

**Creates:**

- `list` command
- Shows all registered budgets with state
- Columns: scope, limit, spent, remaining, %, state
- Options: `--format` (text/json/table), `--state` (filter by state)

---

### `cli:add-report-command`

Implement `report` command for spend breakdown.

**Parameters:**

- None

**Usage:**

```bash
agent invoke cli:add-report-command
```

**Creates:**

- `report` command
- Options: `--scope`, `--period` (1h/24h/7d/30d), `--format` (json/csv/table), `--group-by` (model/scope/time)
- Outputs spend breakdown by model, scope, time period
- Includes anomaly detection summary

---

### `cli:add-set-command`

Implement `set` command for creating/updating budgets.

**Parameters:**

- None

**Usage:**

```bash
agent invoke cli:add-set-command
```

**Creates:**

- `set <scope> <limit>` command
- Options: `--soft-cap`, `--hard-cap`, `--downgrade`, `--disable-tools`, `--reset`
- Creates or updates budget definition
- Validates policy configuration

---

### `cli:add-reset-command`

Implement `reset` command for manual budget reset.

**Parameters:**

- None

**Usage:**

```bash
agent invoke cli:add-reset-command
```

**Creates:**

- `reset <scope>` command
- Options: `--all` (reset all budgets)
- Confirms before reset (with `--force` to skip)
- Emits reset event

---

### `cli:add-validate-config-command`

Implement `validate-config` command.

**Parameters:**

- None

**Usage:**

```bash
agent invoke cli:add-validate-config-command
```

**Creates:**

- `validate-config` command
- Options: `--config` (path to config file)
- Validates YAML/JSON config against schemas
- Reports errors with line numbers

---

### `cli:add-simulate-command`

Implement `simulate` command for request estimation.

**Parameters:**

- None

**Usage:**

```bash
agent invoke cli:add-simulate-command
```

**Creates:**

- `simulate <scope> <model> <tokens>` command
- Options: `--input-tokens`, `--output-tokens`, `--tools`
- Estimates cost and checks if request fits budget
- Shows projected remaining budget after request
- Simulates downgrade if applicable

---

### `cli:add-interactive-mode`

Add interactive/repl mode for exploration.

**Parameters:**

- None

**Usage:**

```bash
agent invoke cli:add-interactive-mode
```

**Creates:**

- `repl` command for interactive exploration
- Commands: `check`, `list`, `simulate`, `help`
- Tab completion for scope names and model IDs
- Live budget state display

## Dependencies

- `types-development:define-budget-scope`
- `types-development:define-budget-policy`
- `budget-engine:create-controller`
- `spend-tracker:create-store`
- `project-setup:add-package` (must create `packages/cli/` first)

## Tests

- Test each command with mock controller
- Test scope parsing (`type:key` format)
- Test output formats (text, json, table)
- Test config validation with invalid configs
- Test simulate command with various budget states
- CLI integration test (spawn process, verify output)
