import { describe, it, expect, beforeEach } from 'vitest';
import { BudgetAwareStrategy } from '../../src/index.js';
import { BudgetController } from '@agent-budget-controller/budget-engine';
import { SpendStore } from '@agent-budget-controller/spend-tracker';
import { BudgetScope } from '@agent-budget-controller/types';

describe('BudgetAwareStrategy', () => {
  let controller: BudgetController;
  let strategy: BudgetAwareStrategy;

  beforeEach(() => {
    const spendTracker = new SpendStore({ maxEntries: 100 });
    controller = new BudgetController({ spendTracker });
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      limit: 10,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });
    strategy = new BudgetAwareStrategy({ controller, defaultScopeType: BudgetScope.User });
  });

  it('always applies', () => {
    expect(strategy.applies()).toBe(true);
  });

  it('has highest priority', () => {
    expect(strategy.priority).toBe(1);
  });

  it('filters models exceeding remaining budget', () => {
    controller.record({
      requestId: 'r1',
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      cost: 7,
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'm',
      provider: 'p',
      timestamp: new Date(),
    });
    const result = strategy.select({
      scopeKey: 'user-123',
      models: [
        { id: 'cheap', estimatedCost: 1 },
        { id: 'expensive', estimatedCost: 5 },
      ],
    });
    expect(result.blocked).toBe(false);
    expect(result.models.map((m) => m.id)).toEqual(['cheap']);
  });

  it('blocks when hard cap reached', () => {
    controller.record({
      requestId: 'r1',
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      cost: 10,
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'm',
      provider: 'p',
      timestamp: new Date(),
    });
    const result = strategy.select({
      scopeKey: 'user-123',
      models: [{ id: 'm', estimatedCost: 1 }],
    });
    expect(result.blocked).toBe(true);
  });

  it('allows all models if no estimated cost', () => {
    const result = strategy.select({
      scopeKey: 'user-123',
      models: [{ id: 'a' }, { id: 'b' }],
    });
    expect(result.models).toHaveLength(2);
  });

  it('falls back to all models when none fit budget', () => {
    controller.record({
      requestId: 'r1',
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      cost: 9,
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'm',
      provider: 'p',
      timestamp: new Date(),
    });
    const result = strategy.select({
      scopeKey: 'user-123',
      models: [{ id: 'a', estimatedCost: 5 }],
    });
    expect(result.models).toHaveLength(1);
  });

  it('uses BudgetScope type for scopeType', () => {
    const result = strategy.select({
      scopeType: BudgetScope.Org,
      scopeKey: 'org-1',
      models: [{ id: 'a' }],
    });
    expect(result.blocked).toBe(false);
  });

  it('falls back to default scope type when invalid scopeType given', () => {
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'default',
      limit: 10,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });
    const result = strategy.select({
      scopeType: 'invalid' as BudgetScope,
      scopeKey: 'default',
      models: [{ id: 'a' }],
    });
    expect(result.blocked).toBe(false);
  });
});
