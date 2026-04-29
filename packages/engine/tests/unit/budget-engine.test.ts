import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import {
  BudgetError,
  BudgetScope,
  BudgetStateEnum,
  EnforcementAction,
  type SpendEntry,
} from '@reaatech/agent-budget-types';
import { beforeEach, describe, expect, it } from 'vitest';
import { BudgetController, DowngradeEngine, PolicyEvaluator, ToolFilter } from '../../src/index.js';

describe('BudgetController', () => {
  let spendTracker: SpendStore;
  let controller: BudgetController;

  beforeEach(() => {
    spendTracker = new SpendStore({ maxEntries: 1000 });
    controller = new BudgetController({ spendTracker });
  });

  function defineUserBudget(limit = 10, softCap = 0.8): void {
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      limit,
      policy: {
        softCap,
        hardCap: 1.0,
        autoDowngrade: [{ from: ['claude-opus-4-1'], to: 'claude-sonnet-4' }],
        disableTools: ['web-search'],
      },
    });
  }

  function spendEntry(cost: number, overrides: Partial<SpendEntry> = {}): SpendEntry {
    return {
      requestId: 'req-1',
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      cost,
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'claude-sonnet-4',
      provider: 'anthropic',
      timestamp: new Date(),
      ...overrides,
    };
  }

  it('allows request when no budget defined', () => {
    const result = controller.check({
      scopeType: BudgetScope.User,
      scopeKey: 'unknown',
      estimatedCost: 5,
      modelId: 'm',
      tools: [],
    });
    expect(result.allowed).toBe(true);
    expect(result.action).toBe(EnforcementAction.Allow);
  });

  it('allows request within budget', () => {
    defineUserBudget();
    const result = controller.check({
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      estimatedCost: 1,
      modelId: 'claude-opus-4-1',
      tools: [],
    });
    expect(result.allowed).toBe(true);
    expect(result.action).toBe(EnforcementAction.Allow);
    expect(result.remaining).toBe(9);
  });

  it('degrades when soft cap reached with matching rule', () => {
    defineUserBudget(10, 0.5);
    controller.record(spendEntry(5.1));
    const result = controller.check({
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      estimatedCost: 0.5,
      modelId: 'claude-opus-4-1',
      tools: [],
    });
    expect(result.action).toBe(EnforcementAction.Degrade);
    expect(result.warning).toContain('Soft cap reached');
  });

  it('suggests downgraded model when soft cap reached', () => {
    defineUserBudget(10, 0.5);
    controller.record(spendEntry(5.1));
    const result = controller.check({
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      estimatedCost: 0.5,
      modelId: 'claude-opus-4-1',
      tools: [],
    });
    expect(result.action).toBe(EnforcementAction.Degrade);
    expect(result.suggestedModel).toBe('claude-sonnet-4');
  });

  it('hard-stops when hard cap reached', () => {
    defineUserBudget();
    controller.record(spendEntry(10));
    const result = controller.check({
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      estimatedCost: 0.1,
      modelId: 'claude-opus-4-1',
      tools: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.action).toBe(EnforcementAction.HardStop);
    expect(result.reason).toBe('Hard cap exceeded');
  });

  it('disables expensive tools at soft cap', () => {
    defineUserBudget(10, 0.5);
    controller.record(spendEntry(5.1));
    const result = controller.check({
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      estimatedCost: 0.5,
      modelId: 'claude-sonnet-4',
      tools: ['web-search', 'file-read'],
    });
    expect(result.disabledTools).toContain('web-search');
  });

  it('records spend and updates state', () => {
    defineUserBudget();
    controller.record(spendEntry(3));
    const state = controller.getState(BudgetScope.User, 'user-123');
    expect(state?.spent).toBe(3);
    expect(state?.remaining).toBe(7);
  });

  it('transitions state active → warned → degraded → stopped', () => {
    defineUserBudget(10, 0.5);
    expect(controller.getState(BudgetScope.User, 'user-123')?.state).toBe(BudgetStateEnum.Active);

    controller.record(spendEntry(5.1));
    expect(controller.getState(BudgetScope.User, 'user-123')?.state).toBe(BudgetStateEnum.Warned);

    controller.record(spendEntry(4.9));
    expect(controller.getState(BudgetScope.User, 'user-123')?.state).toBe(BudgetStateEnum.Stopped);
  });

  it('emits events on state change', () => {
    defineUserBudget(10, 0.5);
    const stateChanges: unknown[] = [];
    controller.on('state-change', (e) => stateChanges.push(e));

    controller.record(spendEntry(5.1));
    expect(stateChanges).toHaveLength(1);
  });

  it('emits threshold-breach events', () => {
    defineUserBudget(10, 0.5);
    const breaches: unknown[] = [];
    controller.on('threshold-breach', (e) => breaches.push(e));

    controller.record(spendEntry(5.1));
    expect(breaches.length).toBeGreaterThan(0);
  });

  it('emits hard-stop event', () => {
    defineUserBudget();
    const hardStops: unknown[] = [];
    controller.on('hard-stop', (e) => hardStops.push(e));

    controller.record(spendEntry(10));
    expect(hardStops).toHaveLength(1);
  });

  it('resets budget to active state', () => {
    defineUserBudget();
    controller.record(spendEntry(10));
    expect(controller.getState(BudgetScope.User, 'user-123')?.state).toBe(BudgetStateEnum.Stopped);

    controller.reset(BudgetScope.User, 'user-123');
    const state = controller.getState(BudgetScope.User, 'user-123');
    if (!state) throw new Error('Expected state to exist');
    expect(state.state).toBe(BudgetStateEnum.Active);
    expect(state.spent).toBe(0);
    expect(state.remaining).toBe(10);
  });

  it('emits budget-reset event', () => {
    defineUserBudget();
    const resets: unknown[] = [];
    controller.on('budget-reset', (e) => resets.push(e));

    controller.reset(BudgetScope.User, 'user-123');
    expect(resets).toHaveLength(1);
  });

  it('suggests downgrade for a model', () => {
    defineUserBudget();
    const suggestion = controller.suggestDowngrade('claude-opus-4-1', BudgetScope.User, 'user-123');
    expect(suggestion).toBe('claude-sonnet-4');
  });

  it('returns undefined downgrade when no budget', () => {
    expect(controller.suggestDowngrade('m', BudgetScope.User, 'unknown')).toBeUndefined();
  });

  it('returns disabled tools for scope', () => {
    defineUserBudget();
    expect(controller.getDisabledTools(BudgetScope.User, 'user-123')).toEqual(['web-search']);
  });

  it('returns empty disabled tools when no budget', () => {
    expect(controller.getDisabledTools(BudgetScope.User, 'unknown')).toEqual([]);
  });

  it('undefines budget and removes state', () => {
    defineUserBudget();
    controller.undefineBudget(BudgetScope.User, 'user-123');
    expect(controller.getBudget(BudgetScope.User, 'user-123')).toBeUndefined();
    expect(controller.getState(BudgetScope.User, 'user-123')).toBeUndefined();
  });

  it('supports wildcard downgrade rules', () => {
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'user-wild',
      limit: 10,
      policy: {
        softCap: 0.8,
        hardCap: 1.0,
        autoDowngrade: [{ from: ['*'], to: 'cheap-model' }],
        disableTools: [],
      },
    });
    const result = controller.check({
      scopeType: BudgetScope.User,
      scopeKey: 'user-wild',
      estimatedCost: 9,
      modelId: 'any-model',
      tools: [],
    });
    expect(result.suggestedModel).toBe('cheap-model');
  });

  it('resolves wildcard scope budgets', () => {
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: '*',
      limit: 50,
      policy: {
        softCap: 0.8,
        hardCap: 1.0,
        autoDowngrade: [],
        disableTools: [],
      },
    });
    const result = controller.check({
      scopeType: BudgetScope.User,
      scopeKey: 'any-user',
      estimatedCost: 10,
      modelId: 'm',
      tools: [],
    });
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(50);
    expect(result.remaining).toBe(40);
  });

  it('exact scope takes priority over wildcard', () => {
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: '*',
      limit: 100,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'vip',
      limit: 500,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });
    const result = controller.check({
      scopeType: BudgetScope.User,
      scopeKey: 'vip',
      estimatedCost: 0,
      modelId: 'm',
      tools: [],
    });
    expect(result.limit).toBe(500);
  });

  it('throws on duplicate budget definition', () => {
    defineUserBudget();
    expect(() =>
      controller.defineBudget({
        scopeType: BudgetScope.User,
        scopeKey: 'user-123',
        limit: 20,
        policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
      }),
    ).toThrow(BudgetError);
  });

  it('throws on invalid scope type in definition', () => {
    expect(() =>
      controller.defineBudget({
        scopeType: 'invalid' as BudgetScope,
        scopeKey: 'test',
        limit: 10,
        policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
      }),
    ).toThrow(BudgetError);
  });

  it('throws on empty scopeKey', () => {
    expect(() =>
      controller.defineBudget({
        scopeType: BudgetScope.User,
        scopeKey: '',
        limit: 10,
        policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
      }),
    ).toThrow('scopeKey must not be empty');
  });

  it('throws on non-positive limit', () => {
    expect(() =>
      controller.defineBudget({
        scopeType: BudgetScope.User,
        scopeKey: 'test',
        limit: 0,
        policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
      }),
    ).toThrow('limit must be positive');
  });

  it('throws on softCap exceeding hardCap', () => {
    expect(() =>
      controller.defineBudget({
        scopeType: BudgetScope.User,
        scopeKey: 'test',
        limit: 10,
        policy: { softCap: 0.9, hardCap: 0.5, autoDowngrade: [], disableTools: [] },
      }),
    ).toThrow('softCap must not exceed hardCap');
  });

  it('transitions to degraded state on degrade action via record', () => {
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'degrade-test',
      limit: 10,
      policy: {
        softCap: 0.5,
        hardCap: 1.0,
        autoDowngrade: [{ from: ['*'], to: 'cheap-model' }],
        disableTools: [],
      },
    });
    controller.record(spendEntry(6, { scopeKey: 'degrade-test' }));
    expect(controller.getState(BudgetScope.User, 'degrade-test')?.state).toBe(
      BudgetStateEnum.Degraded,
    );
  });

  it('returns disable-tools action from check when tools match', () => {
    controller.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'tools-test',
      limit: 10,
      policy: {
        softCap: 0.5,
        hardCap: 1.0,
        autoDowngrade: [],
        disableTools: ['expensive-tool'],
      },
    });
    controller.record(spendEntry(6, { scopeKey: 'tools-test' }));
    const result = controller.check({
      scopeType: BudgetScope.User,
      scopeKey: 'tools-test',
      estimatedCost: 0,
      modelId: 'some-model',
      tools: ['expensive-tool'],
    });
    expect(result.action).toBe('disable-tools');
  });

  it('emitter isolates listener errors', () => {
    defineUserBudget(10, 0.5);
    const goodCalls: unknown[] = [];
    controller.on('state-change', () => {
      throw new Error('bad listener');
    });
    controller.on('state-change', (e) => goodCalls.push(e));

    controller.record(spendEntry(5.1));
    expect(goodCalls).toHaveLength(1);
  });

  it('removes event listeners with off()', () => {
    defineUserBudget(10, 0.5);
    const calls: unknown[] = [];
    const listener = (e: unknown) => calls.push(e);
    controller.on('state-change', listener);
    controller.off('state-change', listener);
    controller.record(spendEntry(5.1));
    expect(calls).toHaveLength(0);
  });

  it('getState returns a defensive copy', () => {
    defineUserBudget();
    const state1 = controller.getState(BudgetScope.User, 'user-123');
    const state2 = controller.getState(BudgetScope.User, 'user-123');
    if (!state1 || !state2) throw new Error('Expected states to exist');
    state1.spent = 999;
    expect(state2.spent).not.toBe(999);
  });

  it('getBudget returns a defensive copy', () => {
    defineUserBudget();
    const budget1 = controller.getBudget(BudgetScope.User, 'user-123');
    const budget2 = controller.getBudget(BudgetScope.User, 'user-123');
    if (!budget1 || !budget2) throw new Error('Expected budgets to exist');
    budget1.policy.softCap = 0.1;
    budget1.policy.autoDowngrade[0] = { from: ['x'], to: 'y' };
    expect(budget2.policy.softCap).toBe(0.8);
    expect(budget2.policy.autoDowngrade[0].to).toBe('claude-sonnet-4');
  });

  it('estimates cost from pricing provider when estimatedCost is zero', () => {
    const pricing = { estimateCost: () => 0.25 };
    const ctrl = new BudgetController({ spendTracker, pricing });
    ctrl.defineBudget({
      scopeType: BudgetScope.User,
      scopeKey: 'pricing-test',
      limit: 10,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });
    const result = ctrl.check({
      scopeType: BudgetScope.User,
      scopeKey: 'pricing-test',
      estimatedCost: 0,
      modelId: 'some-model',
      tools: [],
    });
    expect(result.remaining).toBe(9.75);
  });

  it('listAll returns all budgets', () => {
    defineUserBudget();
    controller.defineBudget({
      scopeType: BudgetScope.Org,
      scopeKey: 'org-1',
      limit: 100,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    });
    const all = controller.listAll();
    expect(all).toHaveLength(2);
  });
});

describe('PolicyEvaluator', () => {
  it('evaluates allow when under soft cap', () => {
    const evaluator = new PolicyEvaluator();
    const result = evaluator.evaluate(5, 10, {
      softCap: 0.8,
      hardCap: 1.0,
      autoDowngrade: [],
      disableTools: [],
    });
    expect(result.action).toBe(EnforcementAction.Allow);
  });

  it('evaluates hard stop at hard cap', () => {
    const evaluator = new PolicyEvaluator();
    const result = evaluator.evaluate(10, 10, {
      softCap: 0.8,
      hardCap: 1.0,
      autoDowngrade: [],
      disableTools: [],
    });
    expect(result.action).toBe(EnforcementAction.HardStop);
  });

  it('handles zero limit without divide by zero', () => {
    const evaluator = new PolicyEvaluator();
    const result = evaluator.evaluate(5, 0, {
      softCap: 0.8,
      hardCap: 1.0,
      autoDowngrade: [],
      disableTools: [],
    });
    expect(result.action).toBe(EnforcementAction.HardStop);
  });
});

describe('DowngradeEngine', () => {
  it('suggests downgrade from rules', () => {
    const engine = new DowngradeEngine();
    const result = engine.suggestDowngrade('premium', [{ from: ['premium'], to: 'standard' }]);
    expect(result).toBe('standard');
  });

  it('follows wildcard rules', () => {
    const engine = new DowngradeEngine();
    const result = engine.suggestDowngrade('anything', [{ from: ['*'], to: 'fallback' }]);
    expect(result).toBe('fallback');
  });

  it('computes downgrade chain', () => {
    const engine = new DowngradeEngine();
    const chain = engine.getDowngradeChain('a', [
      { from: ['a'], to: 'b' },
      { from: ['b'], to: 'c' },
    ]);
    expect(chain).toEqual(['b', 'c']);
  });
});

describe('ToolFilter', () => {
  it('filters disabled tools', () => {
    const filter = new ToolFilter();
    const result = filter.filter(['a', 'b', 'c'], ['b']);
    expect(result.filtered).toEqual(['a', 'c']);
    expect(result.disabled).toEqual(['b']);
  });

  it('returns all tools when no disabled tools', () => {
    const filter = new ToolFilter();
    const result = filter.filter(['a', 'b'], []);
    expect(result.filtered).toEqual(['a', 'b']);
    expect(result.disabled).toEqual([]);
  });
});
