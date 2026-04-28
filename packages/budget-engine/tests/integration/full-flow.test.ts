import { describe, it, expect, beforeEach } from 'vitest';
import { BudgetController } from '../../src/index.js';
import {
  BudgetScope,
  BudgetStateEnum,
  BudgetExceededError,
  type SpendEntry,
} from '@agent-budget-controller/types';
import { SpendStore } from '@agent-budget-controller/spend-tracker';
import { BudgetInterceptor } from '@agent-budget-controller/middleware';

describe('Full Integration Flow', () => {
  let spendTracker: SpendStore;
  let controller: BudgetController;
  let interceptor: BudgetInterceptor;

  beforeEach(() => {
    spendTracker = new SpendStore({ maxEntries: 10_000 });
    controller = new BudgetController({ spendTracker });
    interceptor = new BudgetInterceptor({ controller });
  });

  it('handles complete agent lifecycle', () => {
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'agent-1',
      limit: 4.0,
      policy: {
        softCap: 0.6,
        hardCap: 1.0,
        autoDowngrade: [
          { from: ['claude-opus-4-1'], to: 'claude-sonnet-4' },
          { from: ['claude-sonnet-4'], to: 'claude-haiku-3-5' },
        ],
        disableTools: ['expensive-search', 'code-exec'],
      },
    });

    // Step 1: Normal request
    const ctx1 = interceptor.beforeStep({
      scope: { scopeType: BudgetScope.User, scopeKey: 'agent-1' },
      modelId: 'claude-opus-4-1',
      tools: ['file-read', 'expensive-search'],
      estimatedCost: 0.5,
    });
    expect(ctx1.allowed).toBe(true);
    expect(ctx1.modelId).toBe('claude-opus-4-1');

    interceptor.afterStep({
      ...ctx1,
      actualCost: 0.45,
      inputTokens: 100,
      outputTokens: 50,
      requestId: 'req-1',
    });

    // Step 2: Still within budget
    const ctx2 = interceptor.beforeStep({
      scope: { scopeType: BudgetScope.User, scopeKey: 'agent-1' },
      modelId: 'claude-opus-4-1',
      tools: ['file-read'],
      estimatedCost: 0.5,
    });
    expect(ctx2.allowed).toBe(true);

    interceptor.afterStep({
      ...ctx2,
      actualCost: 0.5,
      inputTokens: 100,
      outputTokens: 50,
      requestId: 'req-2',
    });

    // Step 3: Approaching soft cap
    const ctx3 = interceptor.beforeStep({
      scope: { scopeType: BudgetScope.User, scopeKey: 'agent-1' },
      modelId: 'claude-opus-4-1',
      tools: ['file-read', 'expensive-search'],
      estimatedCost: 2.0,
    });
    expect(ctx3.allowed).toBe(true);
    expect(ctx3.modelId).toBe('claude-sonnet-4');
    expect(ctx3.tools).not.toContain('expensive-search');

    interceptor.afterStep({
      ...ctx3,
      actualCost: 1.8,
      inputTokens: 200,
      outputTokens: 100,
      requestId: 'req-3',
    });

    // Step 4: Spend another chunk to push past soft cap further
    interceptor.afterStep({
      scope: { scopeType: BudgetScope.User, scopeKey: 'agent-1' },
      allowed: true,
      modelId: 'claude-sonnet-4',
      tools: ['file-read'],
      originalModelId: 'claude-sonnet-4',
      originalTools: ['file-read'],
      actualCost: 2.5,
      inputTokens: 300,
      outputTokens: 150,
      requestId: 'req-4',
    });

    // Step 5: Hard stop
    expect(() =>
      interceptor.beforeStep({
        scope: { scopeType: BudgetScope.User, scopeKey: 'agent-1' },
        modelId: 'claude-haiku-3-5',
        tools: ['file-read'],
        estimatedCost: 1.0,
      }),
    ).toThrow(BudgetExceededError);

    const finalState = controller.getState(BudgetScope.User, 'agent-1')!;
    expect(finalState.state).toBe(BudgetStateEnum.Stopped);
    expect(finalState.spent).toBeGreaterThan(4.0);
  });

  it('supports multi-scope isolation', () => {
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'user-a',
      limit: 10,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'user-b',
      limit: 5,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });

    const spend: SpendEntry = {
      requestId: 'r1',
      scopeType: BudgetScope.User,
      scopeKey: 'user-a',
      cost: 7,
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'm',
      provider: 'p',
      timestamp: new Date(),
    };

    controller.record(spend);

    const stateA = controller.getState(BudgetScope.User, 'user-a')!;
    const stateB = controller.getState(BudgetScope.User, 'user-b')!;

    expect(stateA.spent).toBe(7);
    expect(stateB.spent).toBe(0);
    expect(stateA.remaining).toBe(3);
    expect(stateB.remaining).toBe(5);
  });

  it('wildcard budget catches unspecified scopes', () => {
    controller.defineBudget({
      scopeType: BudgetScope.Task,
      scopeKey: '*',
      limit: 2,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });

    const result = controller.check({
      scopeType: BudgetScope.Task,
      scopeKey: 'task-xyz',
      estimatedCost: 0.5,
      modelId: 'm',
      tools: [],
    });

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(2);
    expect(result.remaining).toBe(1.5);
  });

  it('event emission during full lifecycle', () => {
    const events: string[] = [];

    controller.on('state-change', () => events.push('state-change'));
    controller.on('threshold-breach', () => events.push('threshold-breach'));
    controller.on('hard-stop', () => events.push('hard-stop'));
    controller.on('budget-reset', () => events.push('budget-reset'));

    controller.defineBudget({
      scopeType: BudgetScope.Session,
      scopeKey: 'session-1',
      limit: 5,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });

    // Soft cap breach
    controller.record({
      requestId: 'r1',
      scopeType: BudgetScope.Session,
      scopeKey: 'session-1',
      cost: 4.5,
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'm',
      provider: 'p',
      timestamp: new Date(),
    });

    // Hard stop
    controller.record({
      requestId: 'r2',
      scopeType: BudgetScope.Session,
      scopeKey: 'session-1',
      cost: 1.0,
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'm',
      provider: 'p',
      timestamp: new Date(),
    });

    // Reset
    controller.reset(BudgetScope.Session, 'session-1');

    expect(events).toContain('state-change');
    expect(events).toContain('threshold-breach');
    expect(events).toContain('hard-stop');
    expect(events).toContain('budget-reset');
  });
});
