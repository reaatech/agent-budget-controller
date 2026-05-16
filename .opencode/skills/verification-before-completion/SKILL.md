# Verification Before Completion

Before claiming any issue or PR is complete, you MUST verify your changes work correctly.

## Verification Checklist

1. **Run tests** — `pnpm vitest run` — all tests must pass (not just the ones you wrote).
2. **Run typecheck** — `pnpm typecheck` if a tsconfig exists; otherwise verify JS has no syntax errors.
3. **Run lint** — `pnpm lint` if an eslint config exists; verify no new warnings.
4. **Manual verification** — the fix must actually resolve the reported issue:
   - Re-read the issue description and confirm every requirement is met.
   - If the issue includes a reproduction case, run it.
   - If the issue describes a specific error, verify the error no longer occurs.
5. **Edge cases** — think about:
   - Empty/null/undefined inputs
   - Race conditions in async code
   - Error paths (database failures, network timeouts, etc.)

## When the Fix Involves Multiple Files

- Verify imports are correct across all changed files.
- Verify the call chain end-to-end: entry point → adapter → agent → external service → response.
- If a new env var was introduced, verify it is documented in `.env.example`.

## Codebase-Specific Checks

- **Supabase queries**: Verify SQL syntax and parameter numbering.
- **Slack messages**: Verify the message format renders correctly (mrkdwn escapes applied).
- **CLI commands**: Verify the new verb is registered in `bin/repobot.js` and has a `repobot help` entry.
- **Systemd units**: Verify `KillMode=mixed` and `TimeoutStopSec` are present on daemon units.

## When Tests Are Not Enough

Some changes cannot be fully tested in isolation (e.g., GitHub API interactions, Slack webhooks). For these:
- Add a unit test with mocked HTTP responses.
- Document the manual testing steps in the PR description.
- Add integration test notes to `docs/OPERATIONS.md` if the change adds a new external integration.

## Final Gate

Do NOT mark the task as complete until:
- [ ] All tests pass
- [ ] No lint/type errors
- [ ] The original issue scenario has been manually verified
- [ ] No new env vars are undocumented
