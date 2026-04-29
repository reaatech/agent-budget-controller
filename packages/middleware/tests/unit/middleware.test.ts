import { describe, it, expect, beforeEach } from 'vitest';
import { BudgetInterceptor, createBudgetMiddleware } from '../../src/index.js';
import { BudgetController } from '@reaatech/agent-budget-engine';
import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import {
  BudgetScope,
  BudgetExceededError,
  BudgetValidationError,
} from '@reaatech/agent-budget-types';

describe('BudgetInterceptor', () => {
  let controller: BudgetController;
  let interceptor: BudgetInterceptor;

  beforeEach(() => {
    const spendTracker = new SpendStore({ maxEntries: 100 });
    controller = new BudgetController({ spendTracker });
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      limit: 10,
      policy: {
        softCap: 0.8,
        hardCap: 1.0,
        autoDowngrade: [{ from: ['claude-opus-4-1'], to: 'claude-sonnet-4' }],
        disableTools: ['web-search'],
      },
    });
    interceptor = new BudgetInterceptor({ controller });
  });

  it('allows request within budget', () => {
    const ctx = interceptor.beforeStep({
      scope: { scopeType: BudgetScope.User, scopeKey: 'user-123' },
      modelId: 'claude-opus-4-1',
      tools: ['file-read'],
      estimatedCost: 1,
    });
    expect(ctx.allowed).toBe(true);
    expect(ctx.modelId).toBe('claude-opus-4-1');
  });

  it('downgrades model when soft cap reached', () => {
    controller.record({
      requestId: 'r1',
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      cost: 8.5,
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'claude-sonnet-4',
      provider: 'anthropic',
      timestamp: new Date(),
    });
    const ctx = interceptor.beforeStep({
      scope: { scopeType: BudgetScope.User, scopeKey: 'user-123' },
      modelId: 'claude-opus-4-1',
      tools: [],
      estimatedCost: 0.5,
    });
    expect(ctx.modelId).toBe('claude-sonnet-4');
    expect(ctx.originalModelId).toBe('claude-opus-4-1');
  });

  it('filters tools when soft cap reached', () => {
    controller.record({
      requestId: 'r1',
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      cost: 8.5,
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'claude-sonnet-4',
      provider: 'anthropic',
      timestamp: new Date(),
    });
    const ctx = interceptor.beforeStep({
      scope: { scopeType: BudgetScope.User, scopeKey: 'user-123' },
      modelId: 'claude-sonnet-4',
      tools: ['web-search', 'file-read'],
      estimatedCost: 0.5,
    });
    expect(ctx.tools).toEqual(['file-read']);
    expect(ctx.originalTools).toEqual(['web-search', 'file-read']);
  });

  it('throws BudgetExceededError on hard stop', () => {
    controller.record({
      requestId: 'r1',
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      cost: 10,
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'claude-sonnet-4',
      provider: 'anthropic',
      timestamp: new Date(),
    });
    expect(() =>
      interceptor.beforeStep({
        scope: { scopeType: BudgetScope.User, scopeKey: 'user-123' },
        modelId: 'claude-opus-4-1',
        tools: [],
        estimatedCost: 0.1,
      }),
    ).toThrow(BudgetExceededError);
  });

  it('records spend in afterStep', () => {
    const ctx = interceptor.beforeStep({
      scope: { scopeType: BudgetScope.User, scopeKey: 'user-123' },
      modelId: 'claude-sonnet-4',
      tools: [],
      estimatedCost: 1,
    });
    interceptor.afterStep({
      ...ctx,
      actualCost: 1.5,
      inputTokens: 200,
      outputTokens: 100,
      requestId: 'req-after',
    });
    const state = controller.getState(BudgetScope.User, 'user-123');
    expect(state!.spent).toBe(1.5);
  });
});

describe('createBudgetMiddleware', () => {
  let controller: BudgetController;

  beforeEach(() => {
    const spendTracker = new SpendStore({ maxEntries: 100 });
    controller = new BudgetController({ spendTracker });
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'user-456',
      limit: 5,
      policy: {
        softCap: 0.8,
        hardCap: 1.0,
        autoDowngrade: [],
        disableTools: [],
      },
    });
  });

  it('creates middleware from headers', () => {
    const middleware = createBudgetMiddleware({ controller });
    const req = {
      headers: {
        'x-budget-scope-type': 'user',
        'x-budget-scope-key': 'user-456',
      },
    };
    const mw = middleware(req);
    const ctx = mw.beforeStep({ modelId: 'claude-sonnet-4', tools: [] });
    expect(ctx.allowed).toBe(true);
  });

  it('records spend with modelId and tools from beforeStep context', () => {
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'user-789',
      limit: 10,
      policy: {
        softCap: 0.8,
        hardCap: 1.0,
        autoDowngrade: [{ from: ['premium-model'], to: 'cheap-model' }],
        disableTools: ['web-search'],
      },
    });

    const middleware = createBudgetMiddleware({ controller });
    const req = {
      headers: {
        'x-budget-scope-type': 'user',
        'x-budget-scope-key': 'user-789',
      },
    };
    const mw = middleware(req);

    controller.record({
      requestId: 'r1',
      scopeType: BudgetScope.User,
      scopeKey: 'user-789',
      cost: 8.5,
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'premium-model',
      provider: 'test',
      timestamp: new Date(),
    });

    const ctx = mw.beforeStep({
      modelId: 'premium-model',
      tools: ['web-search', 'file-read'],
      estimatedCost: 0.5,
    });

    expect(ctx.modelId).toBe('cheap-model');
    expect(ctx.tools).toEqual(['file-read']);

    mw.afterStep({
      actualCost: 1.2,
      inputTokens: 300,
      outputTokens: 150,
      requestId: 'req-after',
    });

    const state = controller.getState(BudgetScope.User, 'user-789');
    expect(state!.spent).toBe(9.7);
  });

  it('throws on invalid scope type in headers', () => {
    const middleware = createBudgetMiddleware({ controller });
    const req = {
      headers: {
        'x-budget-scope-type': 'invalid-scope',
        'x-budget-scope-key': 'test',
      },
    };
    expect(() => middleware(req)).toThrow(BudgetValidationError);
  });

  it('defaults scope type to user when header missing', () => {
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'default',
      limit: 10,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });
    const middleware = createBudgetMiddleware({ controller });
    const req = { headers: {} };
    const mw = middleware(req);
    const ctx = mw.beforeStep({ modelId: 'm', tools: [] });
    expect(ctx.allowed).toBe(true);
  });
});
