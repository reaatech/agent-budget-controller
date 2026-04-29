import { describe, it, expect, beforeEach } from 'vitest';
import { SpendStore } from '../../src/index.js';
import { BudgetScope, type SpendEntry } from '@reaatech/agent-budget-types';

function makeEntry(overrides: Partial<SpendEntry> = {}): SpendEntry {
  return {
    requestId: 'req-1',
    scopeType: BudgetScope.User,
    scopeKey: 'user-123',
    cost: 0.1,
    inputTokens: 100,
    outputTokens: 50,
    modelId: 'claude-sonnet-4',
    provider: 'anthropic',
    timestamp: new Date(),
    ...overrides,
  };
}

describe('SpendStore', () => {
  let store: SpendStore;

  beforeEach(() => {
    store = new SpendStore({ maxEntries: 100 });
  });

  it('respects max entries option', () => {
    const tiny = new SpendStore({ maxEntries: 2 });
    tiny.record(makeEntry());
    tiny.record(makeEntry());
    tiny.record(makeEntry());
    expect(tiny.size).toBe(2);
  });

  it('records an entry and returns an id', () => {
    const id = store.record(makeEntry());
    expect(typeof id).toBe('number');
    expect(store.size).toBe(1);
  });

  it('tracks spend per scope', () => {
    store.record(makeEntry({ cost: 0.5 }));
    store.record(makeEntry({ cost: 0.3 }));
    expect(store.getSpend(BudgetScope.User, 'user-123')).toBe(0.8);
  });

  it('isolates scopes', () => {
    store.record(makeEntry({ scopeKey: 'user-a', cost: 1.0 }));
    store.record(makeEntry({ scopeKey: 'user-b', cost: 2.0 }));
    expect(store.getSpend(BudgetScope.User, 'user-a')).toBe(1.0);
    expect(store.getSpend(BudgetScope.User, 'user-b')).toBe(2.0);
  });

  it('returns zero for unknown scope', () => {
    expect(store.getSpend(BudgetScope.User, 'unknown')).toBe(0);
  });

  it('lists all scopes of a type', () => {
    store.record(makeEntry({ scopeKey: 'user-a', cost: 1.0 }));
    store.record(makeEntry({ scopeKey: 'user-b', cost: 2.0 }));
    store.record(makeEntry({ scopeType: BudgetScope.Org, scopeKey: 'org-1', cost: 5.0 }));
    const users = store.getAllScopes(BudgetScope.User);
    expect(users).toHaveLength(2);
    expect(users.find((u) => u.scopeKey === 'user-a')?.spend).toBe(1.0);
  });

  it('evicts oldest entries when max reached', () => {
    const smallStore = new SpendStore({ maxEntries: 3 });
    smallStore.record(makeEntry({ cost: 1.0, timestamp: new Date('2026-01-01') }));
    smallStore.record(makeEntry({ cost: 2.0, timestamp: new Date('2026-01-02') }));
    smallStore.record(makeEntry({ cost: 3.0, timestamp: new Date('2026-01-03') }));
    smallStore.record(makeEntry({ cost: 4.0, timestamp: new Date('2026-01-04') }));
    expect(smallStore.size).toBe(3);
    expect(smallStore.getSpend(BudgetScope.User, 'user-123')).toBe(9.0);
  });

  it('calculates rate over a window', () => {
    const now = new Date();
    store.record(makeEntry({ cost: 1.0, timestamp: now }));
    store.record(makeEntry({ cost: 2.0, timestamp: now }));
    const rate = store.getRate(BudgetScope.User, 'user-123', 5);
    expect(rate).toBe(0.6); // $3 / 5 min
  });

  it('projects total spend', () => {
    const now = new Date();
    store.record(makeEntry({ cost: 1.0, timestamp: now }));
    store.record(makeEntry({ cost: 2.0, timestamp: now }));
    const projected = store.projectTotal(BudgetScope.User, 'user-123', 1);
    // current 3 + ratePerHour(0.6*12=7.2) * 1 = 10.2
    expect(projected).toBeCloseTo(10.2, 1);
  });

  it('detects spend spikes', () => {
    for (let i = 0; i < 20; i++) {
      store.record(makeEntry({ cost: 0.1 }));
    }
    store.record(makeEntry({ cost: 5.0 }));
    const spikes = store.detectSpikes(BudgetScope.User, 'user-123', 20, 2);
    expect(spikes.length).toBeGreaterThan(0);
    expect(spikes[0].cost).toBe(5.0);
  });

  it('returns empty spikes when insufficient data', () => {
    store.record(makeEntry({ cost: 1.0 }));
    expect(store.detectSpikes(BudgetScope.User, 'user-123')).toEqual([]);
  });

  it('queries entries in time range', () => {
    store.record(makeEntry({ timestamp: new Date('2026-01-01T10:00:00Z') }));
    store.record(makeEntry({ timestamp: new Date('2026-01-01T11:00:00Z') }));
    store.record(makeEntry({ timestamp: new Date('2026-01-01T12:00:00Z') }));
    const results = store.getEntriesInRange(
      new Date('2026-01-01T10:30:00Z'),
      new Date('2026-01-01T11:30:00Z'),
    );
    expect(results).toHaveLength(1);
  });

  it('filters entries by scope in range query', () => {
    store.record(makeEntry({ scopeKey: 'user-a', timestamp: new Date('2026-01-01T10:00:00Z') }));
    store.record(makeEntry({ scopeKey: 'user-b', timestamp: new Date('2026-01-01T10:00:00Z') }));
    const results = store.getEntriesInRange(
      new Date('2026-01-01T09:00:00Z'),
      new Date('2026-01-01T11:00:00Z'),
      BudgetScope.User,
      'user-a',
    );
    expect(results).toHaveLength(1);
    expect(results[0].scopeKey).toBe('user-a');
  });

  it('returns recent entries', () => {
    store.record(makeEntry({ cost: 1.0 }));
    store.record(makeEntry({ cost: 2.0 }));
    store.record(makeEntry({ cost: 3.0 }));
    const recent = store.getRecentEntries(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].cost).toBe(2.0);
    expect(recent[1].cost).toBe(3.0);
  });

  it('queries entries by model', () => {
    store.record(makeEntry({ modelId: 'model-a' }));
    store.record(makeEntry({ modelId: 'model-b' }));
    store.record(makeEntry({ modelId: 'model-a' }));
    const aEntries = store.getEntriesByModel('model-a');
    expect(aEntries).toHaveLength(2);
  });

  it('cleans up time bucket and model set on eviction', () => {
    const tiny = new SpendStore({ maxEntries: 2 });
    tiny.record(
      makeEntry({ cost: 1.0, modelId: 'only-model', timestamp: new Date('2026-01-01T00:00:00Z') }),
    );
    tiny.record(
      makeEntry({ cost: 2.0, modelId: 'other-model', timestamp: new Date('2026-01-02T00:00:00Z') }),
    );
    tiny.record(
      makeEntry({ cost: 3.0, modelId: 'third', timestamp: new Date('2026-01-03T00:00:00Z') }),
    );
    // First entry evicted — its model and time bucket should be cleaned up
    expect(tiny.getEntriesByModel('only-model')).toEqual([]);
    expect(tiny.size).toBe(2);
  });
});
