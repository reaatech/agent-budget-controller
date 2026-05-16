# Cost-Conscious Development for RepoBot

When using opencode or LLM-assisted workflows in this repo, be mindful of cost.

## Model Cost Awareness

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Cost Profile |
|---|---|---|---|
| `deepseek-v4-pro` | $0.435 | $0.87 | Premium — use for complex reasoning |
| `deepseek-v4-flash` | $0.14 | $0.28 | Standard — use for most tasks |

Flash is ~3× cheaper than Pro. Use flash unless the task genuinely requires the reasoning depth of Pro.

## When to Use Each Model

- **deepseek-v4-flash**: Simple edits, straightforward bug fixes, well-scoped features, deterministic transformations.
- **deepseek-v4-pro**: Complex architectural changes, multi-file refactoring, subtle bug diagnosis, prompt engineering.

## Cost-Saving Practices

1. **Scope your changes narrowly** — don't refactor unrelated code while fixing a bug. Every extra token costs money.
2. **Use targeted file reads** — read only the files relevant to the task, not entire directories.
3. **Batch parallel operations** — when reading multiple independent files, use parallel reads in a single message to minimize round trips.
4. **Write concise prompts** — brief, specific instructions cost less than verbose descriptions.
5. **Reuse existing patterns** — check for existing utility functions before writing new ones. Every new function is new code that needs testing.
6. **Prefer deterministic code over LLM-generated code** for:
   - Schema migrations
   - Configuration files
   - Boilerplate adapters
   - Simple data transformations

## Tracking

Every LLM call should go through `src/utils/cost-util.js#recordCost()` so the worker's daily cost report captures it. If you write a new agent or utility that calls an LLM, ensure it reports cost.

## Soft Cost Cap

Per-job spend target: **under $0.50**. If a single job's resolved cost exceeds $1.00, the approach should be reviewed — the manager may be looping unnecessarily, or the task was too broadly scoped.
