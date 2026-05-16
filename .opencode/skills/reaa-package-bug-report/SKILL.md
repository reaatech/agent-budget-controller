---
name: reaa-package-bug-report
description: When an @reaatech/* package fails to install, import, or behave as documented during this job, file a structured bug report to the repobot-worker internal queue so the maintainers can fix it. Trigger: any @reaatech/* package surfaces a TypeError, missing export, broken workspace:* reference, undocumented API change, ENOENT for a documented file, or runtime crash that contradicts the package's README. Do NOT use for third-party (non-@reaatech) packages or for your own code bugs.
metadata:
  type: reporting
  scope: opencode-stage
---

# Reporting @reaatech package bugs

The repobot-worker pipeline depends on the `@reaatech/*` package family. When
you hit a bug in one of those packages, file a structured report so the
maintainers see it. **A bug means**: the package as published on npm does not
behave the way its README or published documentation says it should.

## When to file

File a report when ALL of the following are true:

1. The package name starts with `@reaatech/`.
2. The behavior contradicts the package's documented contract (README excerpt,
   type signature in `node_modules/@reaatech/<pkg>/`, or pnpm-resolved metadata).
3. You've eliminated your own code as the cause — the failure reproduces with
   a minimal call that matches the package's documented usage.
4. The failure is reproducible (not a flaky network call).

Examples worth reporting:
- `pnpm install` rejects an `@reaatech/*` dep with `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` because the package's npm tarball still references `workspace:*` instead of resolved versions.
- `import { X } from "@reaatech/foo"` throws `does not provide an export named 'X'` even though the README claims `X` is exported.
- A documented function exists but throws `TypeError` on its first documented call shape.
- The package's CLI binary refers to a JS file that isn't shipped in the tarball.

**Do NOT file** for:
- Bugs in third-party (non-`@reaatech/*`) packages — those go through normal npm/github channels.
- Your own code (you wrote a typo, your call shape was wrong, your test mock was incomplete).
- "I would prefer if the API took different arguments" — that's a feature request, not a bug.

## How to file

Invoke the CLI at the absolute worker path. The CLI accepts two forms — pick
whichever you find easier to construct:

### Flag form

```bash
node /home/rick/repobot-worker/bin/ops/report-package-bug.js \
  --package "@reaatech/<name>" \
  --version "<the version from package.json>" \
  --summary "<one-line headline>" \
  --description "<longer paragraph explaining the symptom>" \
  --repro "<minimal call shape that triggers it>" \
  --expected "<what the README says should happen>" \
  --actual "<what actually happened, including any stderr tail>" \
  --severity "error" \
  --stage "builder"
```

### JSON form

```bash
node /home/rick/repobot-worker/bin/ops/report-package-bug.js --json '{
  "package": "@reaatech/<name>",
  "version": "<x.y.z>",
  "summary": "<one-line headline>",
  "description": "<longer paragraph>",
  "repro": "<minimal call shape>",
  "expected": "<documented behavior>",
  "actual": "<observed behavior + error tail>",
  "severity": "error",
  "stage": "builder"
}'
```

### Required vs optional fields

| Field         | Required | Notes                                              |
| ------------- | -------- | -------------------------------------------------- |
| `package`     | YES      | Must start with `@reaatech/`                       |
| `summary`     | YES      | One-line headline (≤ 80 chars ideal)               |
| `version`     | no       | Read from `node_modules/@reaatech/<name>/package.json` if unsure |
| `description` | no       | Paragraph form; what you tried, what went wrong    |
| `repro`       | no       | Minimal code or shell command that triggers it     |
| `expected`    | no       | Quote the README / type signature if you can       |
| `actual`      | no       | Include the first ~20 lines of the error trace     |
| `severity`    | no       | `error` (build-blocking) / `warning` / `info`. Default `error`. |
| `stage`       | no       | `builder` / `quality-fix` / `pre-review` — wherever you are. |

## Confirming the report landed

The CLI exits 0 on success and prints the new row's id. You don't need to
verify further — the daily Slack digest will pick it up and the operator's
local agent will file the GitHub issue. **Do not** open a GitHub issue
yourself; the digest handles that.

## After reporting

If the bug blocks your build (e.g. `pnpm install` won't complete), document
what workaround you applied in your next step — for example: remove the broken
dep from `package.json`, fall back to a sibling package, or stub the missing
function. The maintainers need that context too, so include it in the
`description` field of the report.
