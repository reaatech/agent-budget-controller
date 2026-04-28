# Spend Tracker Skills

## Description

Build real-time spend tracking with in-memory storage, multi-index structure, sliding windows, and O(1) per-scope lookups.

## Skills

### `spend-tracker:create-store`

Create the SpendStore with circular buffer backing.

**Parameters:**

- `maxEntries` (optional): Maximum entries before eviction (default: `500000`)

**Usage:**

```bash
agent invoke spend-tracker:create-store --maxEntries 500000
```

**Creates:**

- `SpendStore` class with `append(entry)` and `get(id)` methods
- Circular buffer implementation (oldest entries evicted first)
- Entry ID generation (ULID or UUID)

---

### `spend-tracker:create-multi-index`

Create multi-index structure for fast lookups.

**Parameters:**

- None

**Usage:**

```bash
agent invoke spend-tracker:create-multi-index
```

**Creates:**

- `SpendIndex` class with three indices:
  - `byScope`: Map<`scopeType:scopeKey`, Set<entryId>>
  - `byTimeBucket`: Map<minute-bucket, Set<entryId>>
  - `byModel`: Map<modelId, Set<entryId>>
- Index maintenance on append/evict

---

### `spend-tracker:create-aggregator`

Create SpendAggregator with sliding window computation.

**Parameters:**

- `windows` (optional): Window definitions (default: `[{name:'1m',seconds:60},{name:'1h',seconds:3600},{name:'24h',seconds:86400}]`)

**Usage:**

```bash
agent invoke spend-tracker:create-aggregator
```

**Creates:**

- `SpendAggregator` class
- `getTotal(scope, window)` — total spend in window
- `getRate(scope, window)` — USD/minute rate
- `projectTotal(scope, hours)` — extrapolated projection

---

### `spend-tracker:implement-scope-lookup`

Implement O(1) per-scope spend lookups with running accumulators.

**Parameters:**

- None

**Usage:**

```bash
agent invoke spend-tracker:implement-scope-lookup
```

**Creates:**

- `SpendAccumulator` class per scope (running total, window totals, rate)
- `getSpend(scopeType, scopeKey)` — O(1) lookup
- `getAllScopes(scopeType)` — list all scopes of a type with their spend

---

### `spend-tracker:add-spike-detection`

Add anomaly/spike detection via moving average + standard deviation.

**Parameters:**

- `windowSize` (optional): Moving average window (default: `20`)
- `thresholdStdDev` (optional): Standard deviation threshold (default: `3`)

**Usage:**

```bash
agent invoke spend-tracker:add-spike-detection --windowSize 20 --thresholdStdDev 3
```

**Creates:**

- `detectSpikes(scope, windowSize?, threshold?)` method
- `SpikeAlert` interface (`entryId`, `cost`, `expectedCost`, `deviation`, `timestamp`)

---

### `spend-tracker:add-time-queries`

Add time-based query methods.

**Parameters:**

- None

**Usage:**

```bash
agent invoke spend-tracker:add-time-queries
```

**Creates:**

- `getEntriesInRange(startTime, endTime, scope?)` method
- `getRecentEntries(count)` method
- `getEntriesByModel(modelId, startTime?, endTime?)` method

---

### `spend-tracker:add-persistence`

Add optional persistence layer (save/restore state).

**Parameters:**

- `format` (optional): Persistence format (`json` or `sqlite`, default: `json`)

**Usage:**

```bash
agent invoke spend-tracker:add-persistence --format json
```

**Creates:**

- `saveState(filePath)` method
- `restoreState(filePath)` method
- Snapshot compression (only keep recent entries + aggregates)

## Dependencies

- `types-development:define-spend-entry`
- `project-setup:add-package` (must create `packages/spend-tracker/` first)

## Tests

- Append 100K entries, verify no memory leak
- Verify O(1) lookup time for scope spend
- Test circular buffer eviction (oldest first)
- Test spike detection with synthetic data
- Test sliding window accuracy
