import { describe, expect, it } from 'vitest';
import {
  BudgetCheckRequestSchema,
  BudgetCheckResultSchema,
  BudgetDefinitionSchema,
  BudgetError,
  BudgetErrorCode,
  BudgetExceededError,
  BudgetPolicySchema,
  BudgetScope,
  BudgetScopeSchema,
  BudgetSnapshotSchema,
  BudgetStateEnum,
  BudgetStateEnumSchema,
  BudgetStateSchema,
  BudgetValidationError,
  DowngradeRuleSchema,
  EnforcementAction,
  EnforcementActionSchema,
  EnforcementResultSchema,
  ScopeIdentifierSchema,
  SpendEntrySchema,
  SpendQuerySchema,
  ToolCostConfigSchema,
  ToolFilterResultSchema,
} from '../../src/index.js';

describe('BudgetScope', () => {
  it('has correct enum values', () => {
    expect(BudgetScope.Task).toBe('task');
    expect(BudgetScope.User).toBe('user');
    expect(BudgetScope.Session).toBe('session');
    expect(BudgetScope.Org).toBe('org');
  });

  it('validates with Zod schema', () => {
    expect(BudgetScopeSchema.parse('task')).toBe(BudgetScope.Task);
    expect(BudgetScopeSchema.parse('user')).toBe(BudgetScope.User);
    expect(BudgetScopeSchema.parse('session')).toBe(BudgetScope.Session);
    expect(BudgetScopeSchema.parse('org')).toBe(BudgetScope.Org);
  });

  it('rejects invalid scope values', () => {
    expect(() => BudgetScopeSchema.parse('invalid')).toThrow();
    expect(() => BudgetScopeSchema.parse('time-window')).toThrow();
  });
});

describe('ScopeIdentifier', () => {
  it('validates correct identifier', () => {
    const valid = { scopeType: BudgetScope.User, scopeKey: 'user-123' };
    expect(ScopeIdentifierSchema.parse(valid)).toEqual(valid);
  });

  it('rejects empty scopeKey', () => {
    expect(() =>
      ScopeIdentifierSchema.parse({ scopeType: BudgetScope.User, scopeKey: '' }),
    ).toThrow();
  });

  it('rejects missing fields', () => {
    expect(() => ScopeIdentifierSchema.parse({ scopeType: BudgetScope.User })).toThrow();
    expect(() => ScopeIdentifierSchema.parse({ scopeKey: 'user-123' })).toThrow();
  });
});

describe('BudgetPolicy', () => {
  it('validates complete policy', () => {
    const policy = {
      softCap: 0.8,
      hardCap: 1.0,
      autoDowngrade: [{ from: ['claude-opus-4-1'], to: 'claude-sonnet-4' }],
      disableTools: ['web-search'],
    };
    const parsed = BudgetPolicySchema.parse(policy);
    expect(parsed.softCap).toBe(0.8);
    expect(parsed.hardCap).toBe(1.0);
    expect(parsed.autoDowngrade).toHaveLength(1);
    expect(parsed.disableTools).toEqual(['web-search']);
  });

  it('applies defaults', () => {
    const parsed = BudgetPolicySchema.parse({});
    expect(parsed.softCap).toBe(0.8);
    expect(parsed.hardCap).toBe(1.0);
    expect(parsed.autoDowngrade).toEqual([]);
    expect(parsed.disableTools).toEqual([]);
  });

  it('rejects out-of-range caps', () => {
    expect(() => BudgetPolicySchema.parse({ softCap: 1.5 })).toThrow();
    expect(() => BudgetPolicySchema.parse({ hardCap: -0.1 })).toThrow();
  });
});

describe('BudgetDefinition', () => {
  it('validates complete definition', () => {
    const def = {
      scopeType: 'user',
      scopeKey: 'user-123',
      limit: 10.0,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
    };
    const parsed = BudgetDefinitionSchema.parse(def);
    expect(parsed.limit).toBe(10.0);
    expect(parsed.scopeKey).toBe('user-123');
  });

  it('rejects non-positive limit', () => {
    expect(() =>
      BudgetDefinitionSchema.parse({
        scopeType: 'user',
        scopeKey: 'u',
        limit: 0,
        policy: {},
      }),
    ).toThrow();
  });

  it('validates definition without optional fields', () => {
    const parsed = BudgetDefinitionSchema.parse({
      scopeType: 'user',
      scopeKey: 'u',
      limit: 5,
      policy: {},
    });
    expect(parsed.limit).toBe(5);
  });
});

describe('EnforcementAction', () => {
  it('has correct enum values', () => {
    expect(EnforcementAction.Allow).toBe('allow');
    expect(EnforcementAction.Warn).toBe('warn');
    expect(EnforcementAction.Degrade).toBe('degrade');
    expect(EnforcementAction.DisableTools).toBe('disable-tools');
    expect(EnforcementAction.HardStop).toBe('hard-stop');
  });

  it('validates with Zod', () => {
    expect(EnforcementActionSchema.parse('hard-stop')).toBe(EnforcementAction.HardStop);
    expect(() => EnforcementActionSchema.parse('block')).toThrow();
  });
});

describe('BudgetStateEnum', () => {
  it('has correct values', () => {
    expect(BudgetStateEnum.Active).toBe('active');
    expect(BudgetStateEnum.Warned).toBe('warned');
    expect(BudgetStateEnum.Degraded).toBe('degraded');
    expect(BudgetStateEnum.Stopped).toBe('stopped');
  });

  it('validates with Zod', () => {
    expect(BudgetStateEnumSchema.parse('active')).toBe(BudgetStateEnum.Active);
    expect(() => BudgetStateEnumSchema.parse('unknown')).toThrow();
  });
});

describe('EnforcementResult', () => {
  it('validates complete result', () => {
    const result = {
      action: EnforcementAction.Degrade,
      allowed: true,
      suggestedModel: 'claude-sonnet-4',
      disabledTools: ['web-search'],
      warning: 'Approaching soft cap',
    };
    const parsed = EnforcementResultSchema.parse(result);
    expect(parsed.allowed).toBe(true);
    expect(parsed.disabledTools).toEqual(['web-search']);
  });

  it('applies defaults for optional arrays', () => {
    const parsed = EnforcementResultSchema.parse({
      action: EnforcementAction.Allow,
      allowed: true,
    });
    expect(parsed.disabledTools).toEqual([]);
  });
});

describe('SpendEntry', () => {
  it('validates complete entry', () => {
    const entry = {
      requestId: 'req-1',
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      cost: 0.05,
      inputTokens: 1000,
      outputTokens: 500,
      modelId: 'claude-sonnet-4',
      provider: 'anthropic',
      timestamp: new Date(),
      metadata: { region: 'us-east-1' },
    };
    const parsed = SpendEntrySchema.parse(entry);
    expect(parsed.cost).toBe(0.05);
    expect(parsed.metadata).toEqual({ region: 'us-east-1' });
  });

  it('rejects negative cost', () => {
    expect(() =>
      SpendEntrySchema.parse({
        requestId: 'req-1',
        scopeType: BudgetScope.User,
        scopeKey: 'u',
        cost: -1,
        inputTokens: 0,
        outputTokens: 0,
        modelId: 'm',
        provider: 'p',
        timestamp: new Date(),
      }),
    ).toThrow();
  });

  it('allows missing metadata', () => {
    const parsed = SpendEntrySchema.parse({
      requestId: 'req-1',
      scopeType: BudgetScope.Task,
      scopeKey: 't1',
      cost: 0.01,
      inputTokens: 0,
      outputTokens: 0,
      modelId: 'm',
      provider: 'p',
      timestamp: new Date(),
    });
    expect(parsed.metadata).toBeUndefined();
  });
});

describe('SpendQuery', () => {
  it('validates partial query', () => {
    const parsed = SpendQuerySchema.parse({ scopeType: BudgetScope.User });
    expect(parsed.scopeType).toBe(BudgetScope.User);
    expect(parsed.scopeKey).toBeUndefined();
  });

  it('validates empty query', () => {
    expect(SpendQuerySchema.parse({})).toEqual({});
  });
});

describe('BudgetState', () => {
  it('validates complete state', () => {
    const state = {
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      limit: 10,
      spent: 7.5,
      remaining: 2.5,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
      state: BudgetStateEnum.Warned,
      lastThreshold: 0.8,
      breachCount: 1,
      lastReset: new Date(),
      lastUpdated: new Date(),
    };
    const parsed = BudgetStateSchema.parse(state);
    expect(parsed.spent).toBe(7.5);
    expect(parsed.breachCount).toBe(1);
  });
});

describe('BudgetSnapshot', () => {
  it('validates snapshot', () => {
    const snapshot = {
      scopeType: BudgetScope.Org,
      scopeKey: 'acme',
      limit: 5000,
      spent: 2500,
      remaining: 2500,
      utilization: 0.5,
      state: BudgetStateEnum.Active,
      lastUpdated: new Date(),
    };
    const parsed = BudgetSnapshotSchema.parse(snapshot);
    expect(parsed.utilization).toBe(0.5);
  });
});

describe('DowngradeRule', () => {
  it('validates rule', () => {
    const rule = { from: ['claude-opus-4-1'], to: 'claude-sonnet-4' };
    const parsed = DowngradeRuleSchema.parse(rule);
    expect(parsed.from).toEqual(['claude-opus-4-1']);
    expect(parsed.to).toBe('claude-sonnet-4');
  });

  it('rejects empty from array', () => {
    expect(() => DowngradeRuleSchema.parse({ from: [], to: 'x' })).toThrow();
  });
});

describe('ToolCostConfig', () => {
  it('validates config', () => {
    const parsed = ToolCostConfigSchema.parse({ toolName: 'web-search', costWeight: 2.0 });
    expect(parsed.toolName).toBe('web-search');
  });

  it('rejects non-positive weight', () => {
    expect(() => ToolCostConfigSchema.parse({ toolName: 'x', costWeight: 0 })).toThrow();
  });
});

describe('ToolFilterResult', () => {
  it('validates result', () => {
    const parsed = ToolFilterResultSchema.parse({
      original: ['a', 'b', 'c'],
      filtered: ['a'],
      disabled: ['b', 'c'],
    });
    expect(parsed.disabled).toEqual(['b', 'c']);
  });
});

describe('BudgetCheckRequest', () => {
  it('validates request', () => {
    const parsed = BudgetCheckRequestSchema.parse({
      scopeType: 'user',
      scopeKey: 'user-123',
      estimatedCost: 0.05,
      modelId: 'claude-opus-4-1',
      tools: ['web-search'],
    });
    expect(parsed.estimatedCost).toBe(0.05);
    expect(parsed.tools).toEqual(['web-search']);
  });

  it('applies default tools', () => {
    const parsed = BudgetCheckRequestSchema.parse({
      scopeType: 'user',
      scopeKey: 'u',
      estimatedCost: 0,
      modelId: 'm',
    });
    expect(parsed.tools).toEqual([]);
  });
});

describe('BudgetCheckResult', () => {
  it('validates complete result', () => {
    const parsed = BudgetCheckResultSchema.parse({
      allowed: true,
      action: EnforcementAction.Degrade,
      remaining: 2.5,
      limit: 10,
      estimatedCost: 0.05,
      suggestedModel: 'claude-sonnet-4',
      disabledTools: ['web-search'],
      warning: 'Soft cap reached',
    });
    expect(parsed.allowed).toBe(true);
    expect(parsed.suggestedModel).toBe('claude-sonnet-4');
  });
});

describe('BudgetError', () => {
  it('constructs base error with code and scope', () => {
    const scope = { scopeType: BudgetScope.User, scopeKey: 'user-123' };
    const err = new BudgetError('Something failed', BudgetErrorCode.Internal, scope);
    expect(err.name).toBe('BudgetError');
    expect(err.code).toBe(BudgetErrorCode.Internal);
    expect(err.scope).toEqual(scope);
    expect(err.message).toBe('Something failed');
  });

  it('serializes to JSON', () => {
    const err = new BudgetError('fail', BudgetErrorCode.Validation);
    const json = err.toJSON();
    expect(json).toHaveProperty('name', 'BudgetError');
    expect(json).toHaveProperty('code', 'BUDGET_VALIDATION');
  });
});

describe('BudgetExceededError', () => {
  it('constructs with spend details', () => {
    const scope = { scopeType: BudgetScope.User, scopeKey: 'user-123' };
    const err = new BudgetExceededError('Hard cap reached', scope, 10.5, 10.0, -0.5, 'hard-stop');
    expect(err.name).toBe('BudgetExceededError');
    expect(err.code).toBe(BudgetErrorCode.Exceeded);
    expect(err.spent).toBe(10.5);
    expect(err.limit).toBe(10.0);
    expect(err.remaining).toBe(-0.5);
    expect(err.action).toBe('hard-stop');
  });

  it('includes spend details in JSON', () => {
    const scope = { scopeType: BudgetScope.User, scopeKey: 'u' };
    const err = new BudgetExceededError('msg', scope, 1, 2, 3, 'a');
    const json = err.toJSON();
    expect(json).toHaveProperty('spent', 1);
    expect(json).toHaveProperty('limit', 2);
    expect(json).toHaveProperty('remaining', 3);
    expect(json).toHaveProperty('action', 'a');
  });
});

describe('BudgetValidationError', () => {
  it('constructs with field', () => {
    const err = new BudgetValidationError('Invalid limit', 'limit');
    expect(err.name).toBe('BudgetValidationError');
    expect(err.code).toBe(BudgetErrorCode.Validation);
    expect(err.field).toBe('limit');
  });

  it('works without field', () => {
    const err = new BudgetValidationError('Bad config');
    expect(err.field).toBeUndefined();
  });

  it('includes field in JSON', () => {
    const err = new BudgetValidationError('msg', 'f');
    expect(err.toJSON()).toHaveProperty('field', 'f');
  });
});
