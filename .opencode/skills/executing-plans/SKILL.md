# Executing Multi-Step Plans for RepoBot

When a job provides a multi-step implementation plan, follow this execution discipline:

## Workflow

1. **Read the plan first** — the full plan in the spec (issue body / PR body) is your authoritative checklist. Do not skim.
2. **Execute one step at a time** — complete each step entirely before moving to the next. Do not interleave steps.
3. **Verify each step** — after completing a step, run `pnpm test` or the step's specific verification command before proceeding.
4. **Report progress** — after each step, note what was done and whether it passed verification. If a step fails, stop and diagnose before continuing.
5. **Do not skip steps** — if a step seems unnecessary, it is not your call to skip it. Escalate.

## When the Plan Is Unclear

If a step is ambiguous, make your best interpretation and document it. If the ambiguity blocks progress, escalate to the manager agent with the specific ambiguity noted.

## Plan Completion

After the final step, run the full test suite (`pnpm test`) and verify the original issue/PR requirements are met. Do not mark the job complete until every step is verified.
