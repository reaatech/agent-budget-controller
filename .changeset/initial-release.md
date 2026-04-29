---
'@reaatech/agent-budget-types': minor
'@reaatech/agent-budget-pricing': minor
'@reaatech/agent-budget-spend-tracker': minor
'@reaatech/agent-budget-engine': minor
'@reaatech/agent-budget-middleware': minor
'@reaatech/agent-budget-otel-bridge': minor
'@reaatech/agent-budget-llm-router-plugin': minor
'@reaatech/agent-budget-cli': minor
---

Initial release of @reaatech/agent-budget-controller packages:

- Budget enforcement engine with check/record/state machine/event emitter
- Real-time in-memory spend tracker with multi-index structure and O(1) lookups
- LLM pricing tables for Anthropic, OpenAI, Google, and AWS Bedrock
- SDK wrapper (BudgetInterceptor) and HTTP middleware utility
- OpenTelemetry span-to-spend recording bridge
- LLM Router budget-aware model filtering strategy
- CLI for budget management (check, list, report, set, reset, validate, simulate)
- Wildcard scope budgets, policy evaluation with auto-downgrade and tool filtering
