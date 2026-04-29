import { describe, it, expect, beforeEach } from 'vitest';
import { SpanListener } from '../../src/index.js';
import { BudgetController } from '@reaatech/agent-budget-engine';
import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import { BudgetScope } from '@reaatech/agent-budget-types';

describe('SpanListener', () => {
  let controller: BudgetController;
  let listener: SpanListener;

  beforeEach(() => {
    const spendTracker = new SpendStore({ maxEntries: 100 });
    controller = new BudgetController({ spendTracker });
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      limit: 10,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });
    listener = new SpanListener({ controller });
  });

  it('records spend from span attributes', () => {
    listener.onSpanEnd(
      {
        'budget.scope_type': 'user',
        'budget.scope_key': 'user-123',
        'llm.cost.total_usd': 2.5,
        'gen_ai.usage.input_tokens': 1000,
        'gen_ai.usage.output_tokens': 500,
        'gen_ai.request.model': 'claude-sonnet-4',
        'gen_ai.system': 'anthropic',
      },
      { requestId: 'span-1' },
    );
    expect(controller.getState(BudgetScope.User, 'user-123')!.spent).toBe(2.5);
  });

  it('computes cost from input + output when total missing', () => {
    listener.onSpanEnd(
      {
        'budget.scope_type': 'user',
        'budget.scope_key': 'user-123',
        'llm.cost.input_tokens_usd': 1.0,
        'llm.cost.output_tokens_usd': 2.0,
      },
      { requestId: 'span-2' },
    );
    expect(controller.getState(BudgetScope.User, 'user-123')!.spent).toBe(3.0);
  });

  it('skips when scope extraction fails', () => {
    listener.onSpanEnd({ 'llm.cost.total_usd': 5.0 });
    expect(controller.getState(BudgetScope.User, 'user-123')!.spent).toBe(0);
  });

  it('uses custom scope extractor', () => {
    const customListener = new SpanListener({
      controller,
      scopeExtractor: () => ({ scopeType: BudgetScope.Org, scopeKey: 'acme' }),
    });
    controller.defineBudget({
      scopeType: BudgetScope.Org,
      scopeKey: 'acme',
      limit: 100,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });
    customListener.onSpanEnd({ 'llm.cost.total_usd': 10.0 });
    expect(controller.getState(BudgetScope.Org, 'acme')!.spent).toBe(10.0);
  });

  it('skips spans with invalid budget scope type', () => {
    listener.onSpanEnd({
      'budget.scope_type': 'invalid-scope',
      'budget.scope_key': 'user-123',
      'llm.cost.total_usd': 5.0,
    });
    expect(controller.getState(BudgetScope.User, 'user-123')!.spent).toBe(0);
  });

  it('records zero cost when no cost attributes present', () => {
    listener.onSpanEnd({
      'budget.scope_type': 'user',
      'budget.scope_key': 'user-123',
      'gen_ai.usage.input_tokens': 100,
      'gen_ai.usage.output_tokens': 50,
    });
    expect(controller.getState(BudgetScope.User, 'user-123')!.spent).toBe(0);
  });
});
