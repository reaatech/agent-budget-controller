# Context Window Budget Management

When working within a limited context window, every token counts. Follow these practices:

## Core Rules

1. **Be concise** — write only the code needed. Don't explain what you're doing in comments unless the logic is non-obvious.
2. **Avoid re-reading files** — once you've read a file, trust your memory of it. Don't re-read unless the file may have changed or you need a specific line.
3. **Use targeted reads** — read specific sections with offset/limit rather than whole large files.
4. **Summarize patterns** — if you've read multiple similar files, note the pattern once rather than re-reading each.
5. **Watch token limits** — if your context is filling up, summarize completed work and drop details no longer needed.

## When Reading the Codebase

- Read the key entry points first (main file, pipeline file, root config).
- Follow imports only as needed for the task at hand.
- Don't explore the entire codebase — scope reads to what the issue/PR specifies.

## When Writing Code

- Match existing patterns without re-reading example files.
- Import only what you use.
- Keep changes minimal — don't refactor unrelated code.

## Cost Awareness

Every token has a cost. The per-job spend target is under $0.50. Minimize round-trips by batching parallel operations.
