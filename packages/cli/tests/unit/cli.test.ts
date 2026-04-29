import { describe, it, expect } from 'vitest';
import { parseScope, formatBudgetState, formatSnapshotTable } from '../../src/index.js';
import { BudgetScope, BudgetStateEnum } from '@reaatech/agent-budget-types';

describe('parseScope', () => {
  it('parses user scope', () => {
    const parsed = parseScope('user:user-123');
    expect(parsed.scopeType).toBe(BudgetScope.User);
    expect(parsed.scopeKey).toBe('user-123');
  });

  it('parses org scope with colon in key', () => {
    const parsed = parseScope('org:acme:corp');
    expect(parsed.scopeType).toBe(BudgetScope.Org);
    expect(parsed.scopeKey).toBe('acme:corp');
  });

  it('throws on invalid format', () => {
    expect(() => parseScope('nocolon')).toThrow('Invalid scope format');
  });

  it('throws on invalid scope type', () => {
    expect(() => parseScope('invalid:key')).toThrow('Invalid scope type');
  });
});

describe('formatBudgetState', () => {
  it('formats as text', () => {
    const state = {
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      limit: 10,
      spent: 5,
      remaining: 5,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
      state: BudgetStateEnum.Active,
      breachCount: 0,
      lastUpdated: new Date('2026-01-01T00:00:00Z'),
    };
    const text = formatBudgetState(state);
    expect(text).toContain('Scope: user:user-123');
    expect(text).toContain('Limit: $10.00');
    expect(text).toContain('State: active');
  });

  it('formats as json', () => {
    const state = {
      scopeType: BudgetScope.User,
      scopeKey: 'user-123',
      limit: 10,
      spent: 5,
      remaining: 5,
      policy: { softCap: 0.8, hardCap: 1.0, autoDowngrade: [], disableTools: [] },
      state: BudgetStateEnum.Active,
      breachCount: 0,
      lastUpdated: new Date('2026-01-01T00:00:00Z'),
    };
    const json = formatBudgetState(state, 'json');
    const parsed = JSON.parse(json);
    expect(parsed.scopeType).toBe('user');
    expect(parsed.limit).toBe(10);
  });

  it('formats missing state', () => {
    expect(formatBudgetState(undefined)).toBe('No budget found');
    expect(formatBudgetState(undefined, 'json')).toBe('null');
  });
});

describe('formatSnapshotTable', () => {
  it('formats multiple snapshots', () => {
    const snapshots = [
      {
        scopeType: BudgetScope.User,
        scopeKey: 'u1',
        limit: 10,
        spent: 5,
        remaining: 5,
        utilization: 0.5,
        state: BudgetStateEnum.Active,
        lastUpdated: new Date(),
      },
      {
        scopeType: BudgetScope.Org,
        scopeKey: 'o1',
        limit: 100,
        spent: 80,
        remaining: 20,
        utilization: 0.8,
        state: BudgetStateEnum.Warned,
        lastUpdated: new Date(),
      },
    ];
    const table = formatSnapshotTable(snapshots);
    expect(table).toContain('SCOPE');
    expect(table).toContain('user:u1');
    expect(table).toContain('org:o1');
    expect(table).toContain('active');
    expect(table).toContain('warned');
  });
});
