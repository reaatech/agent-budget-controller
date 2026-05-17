import { beforeEach, describe, expect, it } from 'vitest';
import { ModelNormalizer, PricingEngine } from '../../src/index.js';

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
    (emptyEngine as unknown as { tables: Map<string, Map<string, unknown>> }).tables.clear();
    expect(() => emptyEngine.lookup('any')).toThrow('Price not found');
  });

  it('caches lookups', () => {
    const price1 = engine.lookup('claude-sonnet-4', 'anthropic');
    const price2 = engine.lookup('claude-sonnet-4', 'anthropic');
    expect(price1).toBe(price2);
  });

  it('clears cache', () => {
    engine.lookup('claude-sonnet-4', 'anthropic');
    engine.clearCache();
    const cache = (engine as unknown as { cache: Map<string, unknown> }).cache;
    expect(cache.size).toBe(0);
  });

  it('loads custom pricing tables (positional)', () => {
    engine.loadTable('custom', {
      'my-model': { inputPricePerMillion: 1.0, outputPricePerMillion: 2.0 },
    });
    const price = engine.lookup('my-model', 'custom');
    expect(price.inputPricePerMillion).toBe(1.0);
  });

  it('loads custom pricing tables (object-style)', () => {
    engine.loadTable({
      provider: 'custom',
      models: {
        'my-model': { inputPricePerMillion: 1.0, outputPricePerMillion: 2.0 },
      },
    });
    const price = engine.lookup('my-model', 'custom');
    expect(price.inputPricePerMillion).toBe(1.0);
  });

  it('computes cost correctly', () => {
    const cost = engine.computeCost(1_000_000, 500_000, 'claude-sonnet-4', 'anthropic');
    expect(cost).toBe(10.5);
  });

  it('computes cost with object-style call', () => {
    const cost = engine.computeCost({
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      modelId: 'claude-sonnet-4',
      provider: 'anthropic',
    });
    expect(cost).toBe(10.5);
  });

  it('estimates cost with default output ratio', () => {
    const cost = engine.estimateCost('claude-sonnet-4', 1_000_000, 'anthropic');
    expect(cost).toBe(10.5);
  });

  it('estimates cost with object-style call', () => {
    const cost = engine.estimateCost({
      modelId: 'claude-sonnet-4',
      estimatedInputTokens: 1_000_000,
      provider: 'anthropic',
    });
    expect(cost).toBe(10.5);
  });

  describe('cache token pricing', () => {
    it('PriceEntry includes optional cache fields', () => {
      const price = engine.lookup('deepseek-v4-pro', 'deepseek');
      expect(price.inputPricePerMillion).toBe(0.435);
      expect(price.outputPricePerMillion).toBe(0.87);
      expect(price.cacheReadPricePerMillion).toBe(0.003625);
      expect(price.cacheWritePricePerMillion).toBe(0.435);
    });

    it('cache reads are billed at discounted rate when specified', () => {
      const cost = engine.computeCost(0, 0, 'deepseek-v4-pro', 'deepseek', 1_000_000);
      expect(cost).toBe(0.003625);
    });

    it('cache writes are billed at the cache-write rate when specified', () => {
      const cost = engine.computeCost(0, 0, 'deepseek-v4-pro', 'deepseek', 0, 1_000_000);
      expect(cost).toBe(0.435);
    });

    it('cache reads fall back to input price when not specified on entry', () => {
      engine.loadTable('no-cache', {
        'model-a': { inputPricePerMillion: 2.0, outputPricePerMillion: 5.0 },
      });
      const cost = engine.computeCost(0, 0, 'model-a', 'no-cache', 1_000_000);
      expect(cost).toBe(2.0);
    });

    it('cache writes fall back to input price when not specified on entry', () => {
      engine.loadTable('no-cache', {
        'model-a': { inputPricePerMillion: 2.0, outputPricePerMillion: 5.0 },
      });
      const cost = engine.computeCost(0, 0, 'model-a', 'no-cache', 0, 1_000_000);
      expect(cost).toBe(2.0);
    });

    it('computeCost with cache tokens using object-style', () => {
      const cost = engine.computeCost({
        inputTokens: 0,
        outputTokens: 0,
        modelId: 'deepseek-v4-pro',
        provider: 'deepseek',
        cacheReadTokens: 1_000_000,
      });
      expect(cost).toBe(0.003625);
    });

    it('estimateCost includes cache read/write estimates', () => {
      const cost = engine.estimateCost('deepseek-v4-pro', 1_000_000, 'deepseek', 0, 1.0);
      expect(cost).toBeCloseTo(0.438625);
    });

    it('estimateCost with cache ratios via object-style', () => {
      const cost = engine.estimateCost({
        modelId: 'deepseek-v4-pro',
        estimatedInputTokens: 1_000_000,
        provider: 'deepseek',
        outputRatio: 0,
        cacheReadRatio: 1.0,
      });
      expect(cost).toBeCloseTo(0.438625);
    });

    it('combined input, output, and cache tokens compute correctly', () => {
      const cost = engine.computeCost(
        1_000_000,
        500_000,
        'deepseek-v4-pro',
        'deepseek',
        1_000_000,
        500_000,
      );
      expect(cost).toBeCloseTo(1.088625);
    });
  });
});
