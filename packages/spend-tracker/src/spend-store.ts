import type { BudgetScope, SpendEntry } from '@agent-budget-controller/types';

export interface SpendAccumulator {
  total: number;
  entryIds: number[];
}

export class SpendStore {
  private entries: SpendEntry[] = [];
  private nextId = 0;
  private byScope = new Map<string, SpendAccumulator>();
  private byTimeBucket = new Map<number, Set<number>>();
  private byModel = new Map<string, Set<number>>();

  constructor(options?: { maxEntries?: number }) {
    this.maxEntries = options?.maxEntries ?? 500_000;
  }

  private readonly maxEntries: number;

  record(entry: SpendEntry): number {
    const id = this.nextId++;

    // Evict oldest if at capacity
    if (this.entries.length >= this.maxEntries) {
      this.evictOldest();
    }

    this.entries.push(entry);
    const scopeKey = this.scopeKey(entry.scopeType, entry.scopeKey);

    // Update scope accumulator
    const acc = this.byScope.get(scopeKey);
    if (acc) {
      acc.total += entry.cost;
      acc.entryIds.push(id);
    } else {
      this.byScope.set(scopeKey, { total: entry.cost, entryIds: [id] });
    }

    // Update time bucket index
    const bucket = this.timeBucket(entry.timestamp);
    const bucketSet = this.byTimeBucket.get(bucket);
    if (bucketSet) {
      bucketSet.add(id);
    } else {
      this.byTimeBucket.set(bucket, new Set([id]));
    }

    // Update model index
    const modelSet = this.byModel.get(entry.modelId);
    if (modelSet) {
      modelSet.add(id);
    } else {
      this.byModel.set(entry.modelId, new Set([id]));
    }

    return id;
  }

  getSpend(scopeType: BudgetScope, scopeKey: string): number {
    const acc = this.byScope.get(this.scopeKey(scopeType, scopeKey));
    return acc?.total ?? 0;
  }

  getAllScopes(scopeType: BudgetScope): Array<{ scopeKey: string; spend: number }> {
    const prefix = `${scopeType}:`;
    const results: Array<{ scopeKey: string; spend: number }> = [];
    for (const [key, acc] of this.byScope) {
      if (key.startsWith(prefix)) {
        results.push({ scopeKey: key.slice(prefix.length), spend: acc.total });
      }
    }
    return results;
  }

  getRate(scopeType: BudgetScope, scopeKey: string, windowMinutes = 5): number {
    const scopePrefix = this.scopeKey(scopeType, scopeKey);
    const now = Date.now();
    const cutoff = now - windowMinutes * 60_000;
    let recentSpend = 0;

    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry.timestamp.getTime() < cutoff) break;
      if (this.scopeKey(entry.scopeType, entry.scopeKey) === scopePrefix) {
        recentSpend += entry.cost;
      }
    }

    return recentSpend / windowMinutes;
  }

  projectTotal(scopeType: BudgetScope, scopeKey: string, windowHours = 1): number {
    const currentSpend = this.getSpend(scopeType, scopeKey);
    const ratePerHour = this.getRate(scopeType, scopeKey, 5) * 12; // 5-min rate → hourly
    return currentSpend + ratePerHour * windowHours;
  }

  detectSpikes(
    scopeType: BudgetScope,
    scopeKey: string,
    windowSize = 20,
    thresholdStdDev = 3,
  ): Array<{
    entryId: number;
    cost: number;
    expectedCost: number;
    deviation: number;
    timestamp: Date;
  }> {
    const scopePrefix = this.scopeKey(scopeType, scopeKey);
    const acc = this.byScope.get(scopePrefix);
    if (!acc || acc.entryIds.length === 0) return [];

    const entryIds = acc.entryIds;

    if (entryIds.length < windowSize) return [];

    const recentIds = entryIds.slice(-windowSize);
    const recentEntries = recentIds
      .map((id) => this.entryById(id))
      .filter((e): e is SpendEntry => e !== undefined);

    if (recentEntries.length === 0) return [];

    const costs = recentEntries.map((e) => e.cost);
    const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
    const variance = costs.reduce((sum, c) => sum + (c - mean) ** 2, 0) / costs.length;
    const stdDev = Math.sqrt(variance);

    const allEntries = entryIds
      .map((id) => ({ entry: this.entryById(id), id }))
      .filter((e): e is { entry: SpendEntry; id: number } => e.entry !== undefined);

    const alerts: Array<{
      entryId: number;
      cost: number;
      expectedCost: number;
      deviation: number;
      timestamp: Date;
    }> = [];

    for (const { entry, id } of allEntries) {
      const deviation = stdDev > 0 ? (entry.cost - mean) / stdDev : 0;
      if (deviation > thresholdStdDev) {
        alerts.push({
          entryId: id,
          cost: entry.cost,
          expectedCost: mean,
          deviation,
          timestamp: entry.timestamp,
        });
      }
    }

    return alerts;
  }

  private entryById(id: number): SpendEntry | undefined {
    const base = this.nextId - this.entries.length;
    if (id < base || id >= this.nextId) return undefined;
    return this.entries[id - base];
  }

  getEntriesInRange(
    startTime: Date,
    endTime: Date,
    scopeType?: BudgetScope,
    scopeKey?: string,
  ): SpendEntry[] {
    return this.entries.filter((e) => {
      const ts = e.timestamp.getTime();
      if (ts < startTime.getTime() || ts > endTime.getTime()) return false;
      if (scopeType !== undefined && e.scopeType !== scopeType) return false;
      if (scopeKey !== undefined && e.scopeKey !== scopeKey) return false;
      return true;
    });
  }

  getRecentEntries(count: number): SpendEntry[] {
    return this.entries.slice(-count);
  }

  getEntriesByModel(modelId: string, startTime?: Date, endTime?: Date): SpendEntry[] {
    const ids = this.byModel.get(modelId);
    if (!ids) return [];
    return this.entries.filter((e, i) => {
      const globalId = this.nextId - this.entries.length + i;
      if (!ids.has(globalId)) return false;
      if (startTime && e.timestamp.getTime() < startTime.getTime()) return false;
      if (endTime && e.timestamp.getTime() > endTime.getTime()) return false;
      return true;
    });
  }

  get size(): number {
    return this.entries.length;
  }

  private evictOldest(): void {
    const removed = this.entries.shift();
    if (!removed) return;

    const scopeKey = this.scopeKey(removed.scopeType, removed.scopeKey);
    const acc = this.byScope.get(scopeKey);
    if (acc) {
      acc.total -= removed.cost;
      if (acc.total < 0) acc.total = 0;
      acc.entryIds.shift();
      if (acc.entryIds.length === 0) {
        this.byScope.delete(scopeKey);
      }
    }

    const bucket = this.timeBucket(removed.timestamp);
    const bucketSet = this.byTimeBucket.get(bucket);
    if (bucketSet) {
      bucketSet.delete(this.nextId - this.entries.length - 1);
      if (bucketSet.size === 0) {
        this.byTimeBucket.delete(bucket);
      }
    }

    const modelSet = this.byModel.get(removed.modelId);
    if (modelSet) {
      modelSet.delete(this.nextId - this.entries.length - 1);
      if (modelSet.size === 0) {
        this.byModel.delete(removed.modelId);
      }
    }
  }

  private scopeKey(scopeType: BudgetScope, scopeKey: string): string {
    return `${scopeType}:${scopeKey}`;
  }

  private timeBucket(timestamp: Date): number {
    return Math.floor(timestamp.getTime() / 60_000);
  }
}
