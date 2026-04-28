import { describe, it, expect, beforeEach } from 'vitest';
import { PricingEngine, ModelNormalizer } from '../../src/index.js';

describe('ModelNormalizer', () => {
  it('normalizes known aliases', () => {
    const n = new ModelNormalizer();
    expect(n.normalize('claude-3-opus', 'anthropic')).toBe('claude-opus-4-1');
    expect(n.normalize('claude-3-sonnet', 'anthropic')).toBe('claude-sonnet-4');
    expect(n.normalize('gpt-4o', 'openai')).toBe('gpt-4-turbo');
  });

  it('returns original modelId when no alias found', () => {
    const n = new ModelNormalizer();
    expect(n.normalize('unknown-model')).toBe('unknown-model');
  });

  it('tries all providers when provider not specified', () => {
    const n = new ModelNormalizer();
    expect(n.normalize('claude-3-opus')).toBe('claude-opus-4-1');
  });

  it('supports custom aliases', () => {
    const n = new ModelNormalizer();
    n.registerAlias('custom', 'my-model', 'canonical-model');
    expect(n.normalize('my-model', 'custom')).toBe('canonical-model');
  });
});

describe('PricingEngine', () => {
  let engine: PricingEngine;

  beforeEach(() => {
    engine = new PricingEngine({ cacheTtlMs: 1000 });
  });

  it('looks up exact match with provider', () => {
    const price = engine.lookup('claude-opus-4-1', 'anthropic');
    expect(price.inputPricePerMillion).toBe(15.0);
    expect(price.outputPricePerMillion).toBe(75.0);
  });

  it('looks up across providers when provider omitted', () => {
    const price = engine.lookup('gpt-4');
    expect(price.inputPricePerMillion).toBe(30.0);
  });

  it('normalizes model names before lookup', () => {
    const price = engine.lookup('claude-3-opus', 'anthropic');
    expect(price.inputPricePerMillion).toBe(15.0);
  });

  it('throws when model not found for known provider', () => {
    expect(() => engine.lookup('unknown-model', 'anthropic')).toThrow('Price not found');
  });

  it('throws when model not found for unknown provider', () => {
    expect(() => engine.lookup('unknown-model', 'unknown-provider')).toThrow('Price not found');
  });

  it('throws when absolutely nothing found', () => {
    const emptyEngine = new PricingEngine();
    emptyEngine.clearCache();
    // Clear tables manually
    (emptyEngine as unknown as { tables: Map<string, Map<string, unknown>> }).tables.clear();
    expect(() => emptyEngine.lookup('any')).toThrow('Price not found');
  });

  it('caches lookups', () => {
    const price1 = engine.lookup('claude-sonnet-4', 'anthropic');
    const price2 = engine.lookup('claude-sonnet-4', 'anthropic');
    expect(price1).toBe(price2); // same reference due to cache
  });

  it('clears cache', () => {
    engine.lookup('claude-sonnet-4', 'anthropic');
    engine.clearCache();
    const cache = (engine as unknown as { cache: Map<string, unknown> }).cache;
    expect(cache.size).toBe(0);
  });

  it('loads custom pricing tables', () => {
    engine.loadTable('custom', {
      'my-model': { inputPricePerMillion: 1.0, outputPricePerMillion: 2.0 },
    });
    const price = engine.lookup('my-model', 'custom');
    expect(price.inputPricePerMillion).toBe(1.0);
  });

  it('computes cost correctly', () => {
    const cost = engine.computeCost(1_000_000, 500_000, 'claude-sonnet-4', 'anthropic');
    // input: 1M * $3/M = $3, output: 0.5M * $15/M = $7.5
    expect(cost).toBe(10.5);
  });

  it('estimates cost with default output ratio', () => {
    const cost = engine.estimateCost('claude-sonnet-4', 1_000_000, 'anthropic');
    // input: 1M * $3/M = $3, output: 0.5M * $15/M = $7.5
    expect(cost).toBe(10.5);
  });
});
