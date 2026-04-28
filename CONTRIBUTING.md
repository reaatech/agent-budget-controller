# Contributing to agent-budget-controller

Thank you for contributing to `agent-budget-controller`! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Keep discussions on topic and professional

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/reaatech/agent-budget-controller.git
cd agent-budget-controller

# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run tests
pnpm run test

# Run type checking
pnpm run typecheck

# Run linting
pnpm run lint
```

### Project Structure

This is a pnpm monorepo with the following packages:

| Package                                      | Description                        |
| -------------------------------------------- | ---------------------------------- |
| `@agent-budget-controller/types`             | Core domain types and Zod schemas  |
| `@agent-budget-controller/pricing`           | LLM pricing table management       |
| `@agent-budget-controller/spend-tracker`     | Real-time spend tracking           |
| `@agent-budget-controller/budget-engine`     | Budget enforcement engine          |
| `@agent-budget-controller/middleware`        | Express/Fastify middleware + SDK   |
| `@agent-budget-controller/otel-bridge`       | OpenTelemetry cost exporter bridge |
| `@agent-budget-controller/llm-router-plugin` | LLM Router integration plugin      |
| `@agent-budget-controller/cli`               | Command-line interface             |

### Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm run build` to verify compilation
4. Run `pnpm run test` to verify tests pass
5. Run `pnpm run lint` to check code style
6. Run `pnpm run typecheck` to verify types
7. Submit a pull request

### Using Agent Skills

This project uses AI agent skills for development. See `AGENTS.md` for details on invoking skills.

```bash
# Example: invoke a skill
agent invoke <skill-name> --param value
```

## Pull Request Guidelines

### Before Submitting

- [ ] All tests pass (`pnpm run test`)
- [ ] Coverage meets threshold (85%+)
- [ ] TypeScript compiles without errors (`pnpm run typecheck`)
- [ ] Linting passes (`pnpm run lint`)
- [ ] Code is formatted (`pnpm run format`)
- [ ] New code has tests
- [ ] Documentation is updated if needed

### PR Title Format

Use conventional commits format:

- `feat: add tool filtering middleware`
- `fix: correct soft cap threshold calculation`
- `docs: update configuration reference`
- `refactor: simplify state machine transitions`
- `test: add integration tests for budget engine`
- `perf: improve scope lookup performance`
- `chore: update dependencies`

### PR Description

Include:

- What changed and why
- Any breaking changes
- Links to related issues
- Test plan / how to verify

## Coding Standards

### TypeScript

- Strict mode enabled
- No `any` types (use `unknown` with type guards if needed)
- Prefer interfaces over type aliases for object shapes
- Use Zod for runtime validation at boundaries

### Code Style

- Prettier for formatting (run `pnpm run format` before committing)
- ESLint for code quality
- 2-space indentation
- Single quotes
- Semicolons required
- Trailing commas in multi-line objects

### Testing

- Unit tests alongside source (`src/` and `tests/unit/`)
- Integration tests in `tests/integration/`
- Contract tests in `tests/contract/`
- Test file naming: `*.test.ts`
- Use Vitest, describe/it/test pattern
- Arrange-Act-Assert structure

### Documentation

- TSDoc comments for all exported types and functions
- README examples should be copy-paste runnable
- Update ARCHITECTURE.md for significant design changes

## Reporting Issues

### Bug Reports

Include:

- Node.js version (`node -v`)
- pnpm version (`pnpm -v`)
- OS and version
- Steps to reproduce
- Expected vs actual behavior
- Minimal reproduction (if possible)

### Feature Requests

Include:

- Use case / problem being solved
- Proposed solution
- Alternatives considered
- Would you be willing to implement it?

## Integration with Sibling Projects

This project integrates with:

- **otel-cost-exporter** (`github.com/reaatech/otel-cost-exporter`, local `../otel-cost-exporter`)
- **llm-router** (`github.com/reaatech/llm-router`, local `../llm-router`)

When making changes that affect integration:

1. Check contract tests still pass
2. Update integration examples
3. Coordinate with sibling project changes if needed

## Release Process

Releases are managed by maintainers:

1. Version bump (semantic versioning)
2. CHANGELOG.md update
3. Git tag creation
4. npm publish
5. GitHub release

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see `LICENSE` file).

## Questions?

- Check `ARCHITECTURE.md` for system design
- Check `DEV_PLAN.md` for development roadmap
- Check `AGENTS.md` for agent skill definitions
- Open a GitHub Discussion for general questions
