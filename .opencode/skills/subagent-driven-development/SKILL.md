# Subagent-Driven Development

For complex jobs, break the work into subagent tasks to maximize parallelism and minimize per-task context cost.

## Defining Subagent Tasks

Each subagent task must specify:
1. **Clear deliverable** — exactly what file(s) to create or modify, and what the expected output is.
2. **Input context** — which files the subagent needs to read to understand the work.
3. **Verification criteria** — how to confirm the deliverable is correct (test to run, lint to pass, etc.).
4. **Constraints** — what the subagent must NOT do (don't modify files outside scope, don't add dependencies, etc.).

## Writing Subagent Specifications

A good subagent specification:
```
Task: Add validation to the user service
Deliverable: src/services/user-service.ts — add validateEmail function
Input: Read src/services/user-service.ts, @reaatech/validation README in packages/
Verify: pnpm test -- tests/services/user-service.test.ts
Constraints: Do not modify any other file. Use the existing validation patterns.
```

## Aggregating Results

After all subagents complete:
1. Run the full test suite (`pnpm test`).
2. Check for import conflicts between subagent changes.
3. Verify the original issue/PR requirements are met.
4. If any subagent result is incompatible with another, reconcile manually.

## When NOT to Use

- Simple single-file changes — just do the work directly.
- Tasks that require understanding the full codebase — a single agent with full context is better.
- Tightly coupled changes — sequential execution is safer.
