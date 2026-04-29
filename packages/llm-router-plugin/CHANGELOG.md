# @reaatech/agent-budget-llm-router-plugin

## 0.2.0

### Minor Changes

- [`e4b7147`](https://github.com/reaatech/agent-budget-controller/commit/e4b714742816e6406ac8c08a88ff51936f551854) Thanks [@reaatech](https://github.com/reaatech)! - Initial release of @reaatech/agent-budget-controller packages:

  - Budget enforcement engine with check/record/state machine/event emitter
  - Real-time in-memory spend tracker with multi-index structure and O(1) lookups
  - LLM pricing tables for Anthropic, OpenAI, Google, and AWS Bedrock
  - SDK wrapper (BudgetInterceptor) and HTTP middleware utility
  - OpenTelemetry span-to-spend recording bridge
  - LLM Router budget-aware model filtering strategy
  - CLI for budget management (check, list, report, set, reset, validate, simulate)
  - Wildcard scope budgets, policy evaluation with auto-downgrade and tool filtering

### Patch Changes

- Updated dependencies [[`e4b7147`](https://github.com/reaatech/agent-budget-controller/commit/e4b714742816e6406ac8c08a88ff51936f551854)]:
  - @reaatech/agent-budget-types@0.2.0
  - @reaatech/agent-budget-engine@0.2.0
