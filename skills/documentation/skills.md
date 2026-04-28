# Documentation Skills

## Description

Generate API reference, configuration guides, integration examples, and maintain project documentation.

## Skills

### `documentation:generate-api-reference`

Generate TSDoc API reference for all packages.

**Parameters:**

- `format` (optional): Output format (`markdown` or `html`, default: `markdown`)

**Usage:**

```bash
agent invoke documentation:generate-api-reference --format markdown
```

**Creates:**

- API reference in `docs/api/`
- Per-package API docs
- Type documentation with examples
- Cross-references between packages

---

### `documentation:create-config-reference`

Create configuration reference guide.

**Parameters:**

- None

**Usage:**

```bash
agent invoke documentation:create-config-reference
```

**Creates:**

- `docs/configuration.md`
- Budget definition config reference
- Policy options reference
- Scope resolver config
- Middleware config
- CLI config file reference
- All options with defaults and examples

---

### `documentation:build-standalone-example`

Build standalone integration example.

**Parameters:**

- None

**Usage:**

```bash
agent invoke documentation:build-standalone-example
```

**Creates:**

- `examples/standalone/` — minimal example using BudgetInterceptor SDK
- Complete working code with package.json
- Demonstrates budget definition, check, record, enforcement

---

### `documentation:build-otel-integration-example`

Build otel-cost-exporter integration example.

**Parameters:**

- None

**Usage:**

```bash
agent invoke documentation:build-otel-integration-example
```

**Creates:**

- `examples/with-otel-cost-exporter/`
- Complete example with OTel SDK setup
- Span processor configuration
- Cost metric subscription
- docker-compose for local testing

---

### `documentation:build-router-integration-example`

Build llm-router integration example.

**Parameters:**

- None

**Usage:**

```bash
agent invoke documentation:build-router-integration-example
```

**Creates:**

- `examples/with-llm-router/`
- llm-router.config.yaml with budget-aware strategy
- Plugin registration
- Fallback chain integration
- Complete working example

---

### `documentation:write-readme`

Write README.md with quickstart.

**Parameters:**

- None

**Usage:**

```bash
agent invoke documentation:write-readme
```

**Creates:**

- `README.md` with:
  - Project overview and problem statement
  - Quick start (5-minute setup)
  - Core concepts (scopes, policies, enforcement)
  - Integration options (standalone, otel, llm-router)
  - Package overview
  - Links to examples and API docs

---

### `documentation:maintain-architecture-doc`

Maintain ARCHITECTURE.md.

**Parameters:**

- None

**Usage:**

```bash
agent invoke documentation:maintain-architecture-doc
```

**Creates/Updates:**

- System overview diagram
- Package descriptions
- Data flow documentation
- State machine documentation
- Configuration examples
- Observability spec

---

### `documentation:maintain-dev-plan`

Maintain DEV_PLAN.md.

**Parameters:**

- None

**Usage:**

```bash
agent invoke documentation:maintain-dev-plan
```

**Creates/Updates:**

- Phase checklist
- Package dependency graph
- External dependencies table
- Design principles

---

### `documentation:generate-changelog`

Generate changelog entries.

**Parameters:**

- `version` (optional): Version tag (default: auto from package.json)
- `type` (optional): Change type (`major`, `minor`, `patch`)

**Usage:**

```bash
agent invoke documentation:generate-changelog --version 0.1.0 --type minor
```

**Creates:**

- CHANGELOG.md entries
- Breaking changes section
- New features section
- Bug fixes section
- Migration notes if applicable

## Dependencies

None — documentation skills can be applied at any time.

## Tests

Verify all documentation examples compile and run. Check all links are valid.
