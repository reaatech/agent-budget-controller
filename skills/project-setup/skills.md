# Project Setup Skills

## Description

Initialize and configure the agent-budget-controller monorepo with all necessary tooling: pnpm workspaces, TypeScript, ESLint, Prettier, Vitest, and package structure.

## Skills

### `project-setup:init`

Initialize a new pnpm workspace monorepo with all packages scaffolded.

**Parameters:**

- `name` (required): Project name (default: `agent-budget-controller`)
- `packages` (optional): Array of package names to create

**Usage:**

```bash
agent invoke project-setup:init --name agent-budget-controller
```

**Creates:**

- `package.json` (root, with workspaces)
- `pnpm-workspace.yaml`
- `tsconfig.json` (root, with path aliases)
- `packages/types/`, `packages/pricing/`, `packages/spend-tracker/`, `packages/engine/`, `packages/middleware/`, `packages/otel-bridge/`, `packages/llm-router-plugin/`, `packages/cli/`
- Each package gets its own `package.json`, `tsconfig.json`, `src/index.ts`, `tests/`

---

### `project-setup:configure-typescript`

Configure TypeScript with strict settings across all packages.

**Parameters:**

- `target` (optional): ES target (default: `ES2022`)
- `module` (optional): Module system (default: `NodeNext`)
- `strict` (optional): Enable strict mode (default: `true`)

**Usage:**

```bash
agent invoke project-setup:configure-typescript --target ES2022 --strict
```

---

### `project-setup:configure-linting`

Set up ESLint + Prettier + Husky + lint-staged.

**Parameters:**

- `prettier` (optional): Include Prettier config (default: `true`)
- `husky` (optional): Include Husky hooks (default: `true`)

**Usage:**

```bash
agent invoke project-setup:configure-linting
```

---

### `project-setup:configure-testing`

Configure Vitest with coverage for all packages.

**Parameters:**

- `coverageThreshold` (optional): Coverage threshold percentage (default: `90`)
- `watch` (optional): Enable watch mode by default (default: `false`)

**Usage:**

```bash
agent invoke project-setup:configure-testing --coverageThreshold 90
```

---

### `project-setup:add-package`

Add a new package to the monorepo.

**Parameters:**

- `name` (required): Package name (without scope)
- `description` (optional): Package description

**Usage:**

```bash
agent invoke project-setup:add-package --name types --description "Core domain types and schemas"
```

---

### `project-setup:add-scripts`

Add npm scripts to root and package-level package.json files.

**Parameters:**

- `scripts` (required): Object of script name → command mappings

**Usage:**

```bash
agent invoke project-setup:add-scripts --scripts '{"build":"tsc -b","test":"vitest run","lint":"eslint .","typecheck":"tsc --noEmit"}'
```

## Dependencies

None — this is the foundational skill set.

## Tests

Run `pnpm install && pnpm run build && pnpm run typecheck` to verify setup.
