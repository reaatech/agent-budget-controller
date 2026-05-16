# Test-Driven Development (TDD) for RepoBot Issues

When fixing a reported issue or implementing a feature, follow TDD practice:

## Workflow

1. **Write a failing test first** — before writing any production code, write a vitest test that reproduces the bug or specifies the new behavior.
2. **Confirm the test fails** — run `pnpm vitest run --reporter=verbose` on the test file in isolation.
3. **Write the minimum production code** to pass the test.
4. **Confirm the test passes** — run the test again.
5. **Refactor** — clean up both test and production code while keeping tests green.

## Vitest Patterns

- Tests live in `tests/` mirroring source layout: `src/utils/foo.js` → `tests/utils/foo.test.js`.
- Import the module under test directly (ESM).
- Mock external services with `vi.mock()`:
  ```js
  import { vi } from "vitest";
  vi.mock("../../src/adapters/db-adapter.js");
  ```
- For HTTP-calling modules, use MSW (Mock Service Worker).
- Async tests use `async` test functions and `await`:
  ```js
  it("returns expected output", async () => {
    const result = await myFunction(input);
    expect(result).toEqual(expected);
  });
  ```

## Coverage Requirements

- Minimum **90% line coverage** on runtime code (`src/**/*.js`).
- CLI entry points (`bin/`) and configuration are excluded.
- Run coverage: `pnpm vitest run --coverage`.
- Coverage config is in `vitest.config.js`.

## Non-Negotiables

- Never skip writing a test because the change seems "too small."
- Every bug fix must have a test that would have caught the bug.
- Every new function must have at least one test (happy path).
- Complex logic requires happy path + error path + boundary case.
