# Release Management Skills

## Description

Manage semantic versioning, changelog generation, npm publishing, pricing table updates, and GitHub releases.

## Skills

### `release-management:setup-changesets`

Configure Changesets for monorepo versioning and changelog generation.

**Parameters:**

- None

**Usage:**

```bash
agent invoke release-management:setup-changesets
```

**Creates:**

- `.changeset/config.json`
- `.changeset/README.md`
- Root devDependency on `@changesets/cli`

---

### `release-management:bump-versions`

Bump versions across all packages using semantic versioning.

**Parameters:**

- `version` (optional): Explicit version (default: auto based on changes)
- `type` (optional): Release type (`major`, `minor`, `patch`, default: auto)
- `preid` (optional): Prerelease identifier (e.g., `beta`, `rc`)

**Usage:**

```bash
agent invoke release-management:bump-versions --type minor
```

**Creates/Updates:**

- All package.json versions (locked in sync for monorepo)
- Git tag: `v{version}`
- Version badge in README

---

### `release-management:create-release-notes`

Create release notes with changelog.

**Parameters:**

- `version` (optional): Version tag (default: from package.json)
- `previousVersion` (optional): Previous version to compare against

**Usage:**

```bash
agent invoke release-management:create-release-notes --version 0.1.0
```

**Creates:**

- Release notes with:
  - Summary of changes
  - Breaking changes section
  - New features
  - Bug fixes
  - Contributors
- Updates CHANGELOG.md

---

### `release-management:publish-to-npm`

Publish all packages to npm.

**Parameters:**

- `scope` (optional): npm scope (default: `@agent-budget-controller`)
- `tag` (optional): npm dist-tag (default: `latest`, or `beta` for prerelease)
- `dryRun` (optional): Dry run without publishing (default: `false`)

**Usage:**

```bash
agent invoke release-management:publish-to-npm --scope '@agent-budget-controller' --dryRun false
```

**Performs:**

- Builds all packages
- Verifies all tests pass
- Publishes each package to npm in dependency order
- Sets dist-tag appropriately
- Verifies publish success

---

### `release-management:update-pricing-tables`

Update pricing tables for all providers.

**Parameters:**

- `providers` (optional): Specific providers to update (default: `all`)

**Usage:**

```bash
agent invoke release-management:update-pricing-tables --providers '["anthropic","openai"]'
```

**Performs:**

- Fetches latest pricing from provider APIs/websites
- Validates price changes (warns on > 20% change)
- Updates pricing table files
- Creates PR with pricing changes
- Runs pricing-related tests

---

### `release-management:tag-github-release`

Create GitHub release with notes and artifacts.

**Parameters:**

- `version` (optional): Version tag
- `prerelease` (optional): Mark as prerelease (default: `false`)
- `draft` (optional): Create as draft (default: `false`)

**Usage:**

```bash
agent invoke release-management:tag-github-release --version 0.1.0 --draft false
```

**Performs:**

- Creates git tag
- Pushes tag to GitHub
- Creates GitHub release with release notes
- Attaches compiled artifacts (if any)
- Triggers npm publish workflow

---

### `release-management:handle-breaking-changes`

Handle breaking change documentation and migration guides.

**Parameters:**

- `version` (optional): Version with breaking changes

**Usage:**

```bash
agent invoke release-management:handle-breaking-changes --version 1.0.0
```

**Creates:**

- Breaking changes section in release notes
- Migration guide in `docs/migration-v1.md`
- Deprecation warnings in code
- Upgrade instructions

---

### `release-management:create-github-release-workflow`

Create automated GitHub release workflow.

**Parameters:**

- None

**Usage:**

```bash
agent invoke release-management:create-github-release-workflow
```

**Creates:**

- `.github/workflows/release.yaml`
- Triggered on version bump PR merge
- Runs tests, builds, publishes to npm
- Creates GitHub release
- Updates pricing tables if changed

## Dependencies

- `ci-cd:setup-npm-publishing` (for npm token configuration)
- `documentation:generate-changelog` (for changelog generation)

## Tests

Dry run the full release process. Verify npm publish in dry-run mode. Verify GitHub release creation with draft flag.
