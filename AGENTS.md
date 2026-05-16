# Agent rules — repobot working directory

You are working on a real reaatech repository clone. Your job is bounded
by a single GitHub Issue or Pull Request — do NOT make changes outside
the scope of that issue/PR.

## Source of truth
- The issue/PR body + comments are the spec. Re-read them before acting.
- Existing tests pin existing behavior. Don't break green tests to make
  your fix pass — fix the bug at its root cause.

## Skills
`.opencode/skills/<name>/SKILL.md` contains reusable patterns. Use the
`skill` tool to list and read them. If a skill matches your task, follow
it instead of improvising.

## Done means
- The issue's reproduction case passes (for issues).
- The PR's changed-file coverage meets the repo's bar (for PRs).
- The repo's defined `pnpm` scripts (test / typecheck / lint, whichever
  exist) all exit 0.
Don't claim done before all three are true.
