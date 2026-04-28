# CI/CD Skills

## Description

Configure GitHub Actions workflows for automated build, test, lint, typecheck, security scanning, and npm publishing.

## Skills

### `ci-cd:create-build-workflow`

Create GitHub Actions build workflow.

**Parameters:**

- None

**Usage:**

```bash
agent invoke ci-cd:create-build-workflow
```

**Creates:**

- `.github/workflows/ci.yaml`
- Runs on: push to main, PRs
- Jobs: build, test, lint, typecheck
- pnpm caching for faster builds
- Matrix testing across Node 20, 22

---

### `ci-cd:configure-automated-testing`

Configure automated testing in CI.

**Parameters:**

- `coverage` (optional): Enable coverage reporting (default: `true`)

**Usage:**

```bash
agent invoke ci-cd:configure-automated-testing --coverage true
```

**Creates:**

- Vitest CI configuration
- Coverage upload to codecov (optional)
- Test result summaries in PR comments
- Flaky test detection

---

### `ci-cd:add-security-scanning`

Add security scanning (npm audit, dependency check).

**Parameters:**

- None

**Usage:**

```bash
agent invoke ci-cd:add-security-scanning
```

**Creates:**

- `.github/workflows/security.yaml`
- `npm audit` on every PR
- Dependency vulnerability scanning
- Snyk integration (optional)
- Fails PR on high/critical vulnerabilities

---

### `ci-cd:configure-coverage-reporting`

Configure coverage reporting.

**Parameters:**

- `provider` (optional): Coverage provider (`codecov` or `coveralls`, default: `codecov`)

**Usage:**

```bash
agent invoke ci-cd:configure-coverage-reporting --provider codecov
```

**Creates:**

- Coverage artifact upload
- Coverage diff in PR comments
- Badge in README
- Coverage trend tracking

---

### `ci-cd:setup-npm-publishing`

Set up artifact publishing to npm.

**Parameters:**

- `scope` (optional): npm scope (default: `@agent-budget-controller`)
- `registry` (optional): npm registry URL (default: `https://registry.npmjs.org`)

**Usage:**

```bash
agent invoke ci-cd:setup-npm-publishing --scope '@agent-budget-controller'
```

**Creates:**

- `.github/workflows/publish.yaml`
- Triggered on GitHub release creation
- Publishes all packages to npm
- Provenance attestation
- Requires npm token in secrets

---

### `ci-cd:add-branch-protection`

Add branch protection rules configuration.

**Parameters:**

- None

**Usage:**

```bash
agent invoke ci-cd:add-branch-protection
```

**Creates:**

- `.github/branch-protection.json` (for GitHub API application)
- Required status checks: build, test, lint, typecheck
- Required PR review
- Dismiss stale reviews on new push
- Require signed commits (optional)

---

### `ci-cd:add-dependabot`

Configure Dependabot for dependency updates.

**Parameters:**

- None

**Usage:**

```bash
agent invoke ci-cd:add-dependabot
```

**Creates:**

- `.github/dependabot.yaml`
- Daily checks for npm dependencies
- Weekly checks for GitHub Actions
- Auto-create PRs for patch/minor updates
- Grouped updates for monorepo packages

---

### `ci-cd:add-performance-regression-check`

Add performance regression detection in CI.

**Parameters:**

- None

**Usage:**

```bash
agent invoke ci-cd:add-performance-regression-check
```

**Creates:**

- Performance benchmark workflow
- Compares against baseline on main
- Fails if p99 latency increases > 10%
- Stores benchmark results as artifacts

## Dependencies

None — CI/CD skills can be applied at any time.

## Tests

Verify workflows run successfully by creating a test PR. Check all status checks pass.
