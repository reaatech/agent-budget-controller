---
"@reaatech/agent-budget-engine": patch
"@reaatech/agent-budget-pricing": patch
"@reaatech/agent-budget-types": patch
---

- **@reaatech/agent-budget-engine** (patch): Fixes a TypeError in PolicyEvaluator (and BudgetController.suggestDowngrade) that crashed when a minimal policy omitted autoDowngrade or disableTools. Backwards-compatible null-guard addition with a regression test.
- **@reaatech/agent-budget-pricing** (patch): Adds optional cache read/write token pricing to PriceEntry and a new options parameter on PricingEngine.computeCost, plus provider table updates. Additive, backwards-compatible feature for prompt-caching cost accuracy.
- **@reaatech/agent-budget-types** (patch): Upgrades the runtime zod dependency from v3 to v4 and migrates schemas (z.nativeEnum → z.enum, z.record key type made explicit). Public schema names and shapes are preserved.
