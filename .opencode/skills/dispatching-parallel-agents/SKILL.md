# Dispatching Parallel Subagents

When a job involves multiple independent work items, dispatch parallel subagents to reduce wall-clock time and cost.

## When to Dispatch in Parallel

Dispatch parallel subagents when:
1. **Tasks are independent** — the output of one task does not depend on the output of another.
2. **No shared mutable state** — each subagent works on a distinct set of files or directories.
3. **Work is well-scoped** — each subagent has a clear, narrow deliverable that can be verified independently.

## How to Dispatch

1. Break the work into discrete, named sub-tasks.
2. For each sub-task, write a clear specification of what to produce.
3. Dispatch all subagents simultaneously.
4. Collect results from all subagents.
5. Verify each result independently.
6. Aggregate and reconcile results into the final output.

## Anti-Patterns

- **Do NOT** dispatch subagents that modify the same file — merge conflicts waste time.
- **Do NOT** dispatch subagents when tasks are sequential — this wastes context and cost.
- **Do NOT** dispatch more subagents than necessary — each one consumes context budget.

## Verification

Each subagent's output must pass `pnpm test` (or its specific verification command) before aggregation. If any subagent fails, fix it or re-dispatch.
