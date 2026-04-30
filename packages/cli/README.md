# @reaatech/agent-budget-cli

[![npm version](https://img.shields.io/npm/v/@reaatech/agent-budget-cli.svg)](https://www.npmjs.com/package/@reaatech/agent-budget-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/agent-budget-controller/ci.yml?branch=main&label=CI)](https://github.com/reaatech/agent-budget-controller/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Command-line interface for managing agent budgets — define budgets, check remaining spend, list active scopes, generate spend reports, simulate pre-flight checks, and manually reset budgets. Installs a global `agent-budget` binary.

## Installation

```bash
npm install -g @reaatech/agent-budget-cli
# or
pnpm add -g @reaatech/agent-budget-cli
```

For project-local usage:

```bash
npm install @reaatech/agent-budget-cli
pnpm add @reaatech/agent-budget-cli
```

## Commands

### `agent-budget check`

Check remaining budget for a scope.

```bash
agent-budget check --scope user:42
# → User user:42 — $7.50 remaining of $10.00 (active)

agent-budget check --scope org:acme --json
# → {"scopeType":"org","scopeKey":"acme","spent":45.00,"remaining":5.00,...}
```

| Option               | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `--scope <type:key>` | Scope identifier (e.g., `user:42`, `org:acme`, `task:abc`) |
| `--json`             | Output as JSON instead of human-readable text              |

### `agent-budget list`

List all active budgets.

```bash
agent-budget list
agent-budget list --scope-type user
agent-budget list --json
```

| Option                | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `--scope-type <type>` | Filter by scope type (`task`, `user`, `session`, `org`) |
| `--json`              | Output as JSON                                          |

### `agent-budget report`

Generate a spend breakdown report.

```bash
agent-budget report --scope user:42
agent-budget report --scope user:42 --hours 24
agent-budget report --scope user:42 --json
```

| Option               | Description                       |
| -------------------- | --------------------------------- |
| `--scope <type:key>` | Scope to report on                |
| `--hours <n>`        | Time window in hours (default: 1) |
| `--json`             | Output as JSON                    |

### `agent-budget set`

Create or update a budget.

```bash
agent-budget set --scope user:42 --limit 10.00 --soft-cap 0.8 --hard-cap 0.95
agent-budget set --scope org:acme --limit 100.00 --downgrade "claude-opus-4-1:claude-sonnet-4"
```

| Option                  | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `--scope <type:key>`    | Scope identifier                                  |
| `--limit <dollars>`     | Budget limit in dollars                           |
| `--soft-cap <0-1>`      | Soft cap threshold (default: 0.8)                 |
| `--hard-cap <0-1>`      | Hard cap threshold (default: 1.0)                 |
| `--downgrade <from:to>` | Auto-downgrade rule (repeatable)                  |
| `--disable-tool <name>` | Tool to disable when budget tightens (repeatable) |

### `agent-budget reset`

Manually reset a budget (clears spend, resets state to Active).

```bash
agent-budget reset --scope user:42
agent-budget reset --scope user:42 --all
```

| Option               | Description      |
| -------------------- | ---------------- |
| `--scope <type:key>` | Scope to reset   |
| `--all`              | Reset all scopes |

### `agent-budget simulate`

Estimate whether a proposed request fits within the remaining budget.

```bash
agent-budget simulate --scope user:42 --model claude-opus-4-1 --tokens 2000
agent-budget simulate --scope user:42 --model claude-sonnet-4 --tokens 500 --json
```

| Option               | Description                   |
| -------------------- | ----------------------------- |
| `--scope <type:key>` | Scope to check against        |
| `--model <id>`       | Model ID to estimate cost for |
| `--tokens <n>`       | Estimated input tokens        |
| `--json`             | Output as JSON                |

### `agent-budget validate-config`

Validate a budget configuration file.

```bash
agent-budget validate-config --file ./budgets.json
agent-budget validate-config --file ./budgets.yaml
```

| Option          | Description                                      |
| --------------- | ------------------------------------------------ |
| `--file <path>` | Path to budget configuration file (JSON or YAML) |

## Library Exports

The CLI package also exports utility functions for programmatic use:

```typescript
import { parseScope, formatBudgetState, formatSnapshotTable } from '@reaatech/agent-budget-cli';
```

### `parseScope(input: string): ParsedScope`

Parse a `"type:key"` string into a structured scope identifier.

```typescript
parseScope('user:42');
// → { scopeType: BudgetScope.User, scopeKey: "42" }

parseScope('org:acme-corp');
// → { scopeType: BudgetScope.Org, scopeKey: "acme-corp" }
```

### `formatBudgetState(state: BudgetState): string`

Format a budget state into human-readable text or JSON.

### `formatSnapshotTable(snapshots: BudgetSnapshot[]): string`

Format an array of budget snapshots into a fixed-width ASCII table.

```
SCOPE          LIMIT  SPENT  REMAINING  STATE
user:42        10.00  2.50   7.50       active
user:99        5.00   4.80   0.20       degraded
org:acme       100.00 95.00  5.00       warned
```

## Related Packages

- [`@reaatech/agent-budget-types`](https://www.npmjs.com/package/@reaatech/agent-budget-types) — Core types
- [`@reaatech/agent-budget-engine`](https://www.npmjs.com/package/@reaatech/agent-budget-engine) — Enforcement engine
- [`@reaatech/agent-budget-spend-tracker`](https://www.npmjs.com/package/@reaatech/agent-budget-spend-tracker) — Spend tracking
- [`@reaatech/agent-budget-pricing`](https://www.npmjs.com/package/@reaatech/agent-budget-pricing) — LLM pricing tables
- [`@reaatech/agent-budget-middleware`](https://www.npmjs.com/package/@reaatech/agent-budget-middleware) — HTTP middleware

## License

[MIT](https://github.com/reaatech/agent-budget-controller/blob/main/LICENSE)
