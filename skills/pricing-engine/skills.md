# Pricing Engine Skills

## Description

Implement pricing table management for LLM providers with lookup, caching, and fallback support.

## Skills

### `pricing-engine:create-table`

Create a pricing table for a specific LLM provider.

**Parameters:**

- `provider` (required): Provider name (e.g., `anthropic`, `openai`, `google`, `aws-bedrock`)
- `models` (required): Array of model pricing entries

**Usage:**

```bash
agent invoke pricing-engine:create-table --provider anthropic --models '[{"id":"claude-opus-4-1","inputPricePerMillion":15,"outputPricePerMillion":75},{"id":"claude-sonnet-4","inputPricePerMillion":3,"outputPricePerMillion":15}]'
```

**Creates:**

- Provider pricing table file in `packages/pricing/src/tables/`
- Model entries with input/output pricing per million tokens

---

### `pricing-engine:add-provider`

Add a complete provider pricing table with default models.

**Parameters:**

- `provider` (required): Provider name

**Usage:**

```bash
agent invoke pricing-engine:add-provider --provider anthropic
```

**Creates default models for:**

- `anthropic`: claude-opus-4-1, claude-sonnet-4, claude-haiku-3-5
- `openai`: gpt-4, gpt-4-mini, gpt-4-turbo, o1, o3
- `google`: gemini-2.0-flash, gemini-2.0-pro
- `aws-bedrock`: claude-3-sonnet, claude-3-haiku, llama-3, mistral-large

---

### `pricing-engine:build-lookup-engine`

Create the PricingEngine class with LRU caching.

**Parameters:**

- `cacheSize` (optional): LRU cache size (default: `10000`)
- `ttlMs` (optional): Cache TTL in milliseconds (default: `3600000`)

**Usage:**

```bash
agent invoke pricing-engine:build-lookup-engine --cacheSize 10000
```

**Creates:**

- `PricingEngine` class with `lookup(modelId, provider)` method
- LRU cache for price lookups
- Fallback chain: exact match → normalized → provider default → error

---

### `pricing-engine:create-normalizer`

Create ModelNormalizer for provider-specific model name mapping.

**Parameters:**

- None

**Usage:**

```bash
agent invoke pricing-engine:create-normalizer
```

**Creates:**

- `ModelNormalizer` class
- Provider-specific model name aliases (e.g., `claude-3-opus` → `claude-opus-4-1`)
- `normalize(modelId, provider)` method

---

### `pricing-engine:add-file-override`

Support file-based pricing overrides (YAML/JSON config).

**Parameters:**

- `format` (optional): Config format (`yaml` or `json`, default: `yaml`)

**Usage:**

```bash
agent invoke pricing-engine:add-file-override --format yaml
```

**Creates:**

- `loadPricingOverrides(filePath)` function
- `PricingOverrideSchema` (Zod)
- Example `pricing.overrides.yaml` file

---

### `pricing-engine:compute-cost`

Add cost computation utilities.

**Parameters:**

- None

**Usage:**

```bash
agent invoke pricing-engine:compute-cost
```

**Creates:**

- `computeCost(inputTokens, outputTokens, pricePerMillionInput, pricePerMillionOutput)` function
- `estimateCost(modelId, estimatedInputTokens)` with default 0.5x output ratio

## Dependencies

- `types-development:define-budget-scope`
- `project-setup:add-package` (must create `packages/pricing/` first)

## Tests

Test price lookups with known model names. Verify cache hit/miss behavior. Test fallback chain resolution.
