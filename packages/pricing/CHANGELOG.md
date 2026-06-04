# @reaatech/agent-budget-pricing

## 0.1.1

### Patch Changes

- [`1dc4bb4`](https://github.com/reaatech/agent-budget-controller/commit/1dc4bb4f51f5cb4c50818f781409c0050baa981c) Thanks [@reaatech](https://github.com/reaatech)! - - **@reaatech/agent-budget-engine** (patch): Fixes a TypeError in PolicyEvaluator (and BudgetController.suggestDowngrade) that crashed when a minimal policy omitted autoDowngrade or disableTools. Backwards-compatible null-guard addition with a regression test.
  - **@reaatech/agent-budget-pricing** (patch): Adds optional cache read/write token pricing to PriceEntry and a new options parameter on PricingEngine.computeCost, plus provider table updates. Additive, backwards-compatible feature for prompt-caching cost accuracy.
  - **@reaatech/agent-budget-types** (patch): Upgrades the runtime zod dependency from v3 to v4 and migrates schemas (z.nativeEnum → z.enum, z.record key type made explicit). Public schema names and shapes are preserved.
- Updated dependencies [[`1dc4bb4`](https://github.com/reaatech/agent-budget-controller/commit/1dc4bb4f51f5cb4c50818f781409c0050baa981c)]:
  - @reaatech/agent-budget-types@0.1.1
