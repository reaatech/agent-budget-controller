import { BudgetError, BudgetErrorCode } from '@reaatech/agent-budget-types';
import { ModelNormalizer } from './model-normalizer.js';
import { anthropicPricing } from './tables/anthropic.js';
import { awsBedrockPricing } from './tables/aws-bedrock.js';
import { googlePricing } from './tables/google.js';
import { openaiPricing } from './tables/openai.js';

export interface PriceEntry {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cacheReadPricePerMillion?: number;
  cacheWritePricePerMillion?: number;
}

export interface ComputeCostOptions {
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export class PricingEngine {
  private tables: Map<string, Map<string, PriceEntry>> = new Map();
  private normalizer = new ModelNormalizer();
  private cache: Map<string, { entry: PriceEntry; expiresAt: number }> = new Map();
  private cacheTtlMs: number;

  constructor(options?: { cacheTtlMs?: number }) {
    this.cacheTtlMs = options?.cacheTtlMs ?? 3600_000;
    this.loadDefaults();
  }

  private loadDefaults(): void {
    this.loadTable(anthropicPricing.provider, anthropicPricing.models);
    this.loadTable(openaiPricing.provider, openaiPricing.models);
    this.loadTable(googlePricing.provider, googlePricing.models);
    this.loadTable(awsBedrockPricing.provider, awsBedrockPricing.models);
  }

  loadTable(provider: string, models: Record<string, PriceEntry>): void {
    const map = new Map<string, PriceEntry>();
    for (const [modelId, entry] of Object.entries(models)) {
      map.set(modelId.toLowerCase(), entry);
    }
    this.tables.set(provider.toLowerCase(), map);
    this.cache.clear();
  }

  lookup(modelId: string, provider?: string): PriceEntry {
    const cacheKey = `${provider ?? 'any'}:${modelId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.entry;
    }

    const normalized = this.normalizer.normalize(modelId, provider);
    const entry = this.resolve(normalized, provider);
    this.cache.set(cacheKey, { entry, expiresAt: Date.now() + this.cacheTtlMs });
    return entry;
  }

  private resolve(modelId: string, provider?: string): PriceEntry {
    if (provider) {
      const table = this.tables.get(provider.toLowerCase());
      if (table) {
        const exact = table.get(modelId.toLowerCase());
        if (exact) return exact;
      }
    }

    for (const [, table] of this.tables) {
      const match = table.get(modelId.toLowerCase());
      if (match) return match;
    }

    throw new BudgetError(
      `Price not found for model: ${modelId} (provider: ${provider ?? 'any'})`,
      BudgetErrorCode.NotFound,
    );
  }

  computeCost(
    inputTokens: number,
    outputTokens: number,
    modelId: string,
    provider?: string,
    options?: ComputeCostOptions,
  ): number {
    const price = this.lookup(modelId, provider);
    const cacheReadTokens = options?.cacheReadTokens ?? 0;
    const cacheWriteTokens = options?.cacheWriteTokens ?? 0;
    const uncachedInputTokens = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens);
    const inputCost = (uncachedInputTokens * price.inputPricePerMillion) / 1_000_000;
    const outputCost = (outputTokens * price.outputPricePerMillion) / 1_000_000;
    const cacheReadCost =
      (cacheReadTokens * (price.cacheReadPricePerMillion ?? price.inputPricePerMillion)) /
      1_000_000;
    const cacheWriteCost =
      (cacheWriteTokens * (price.cacheWritePricePerMillion ?? price.inputPricePerMillion)) /
      1_000_000;
    return inputCost + outputCost + cacheReadCost + cacheWriteCost;
  }

  estimateCost(
    modelId: string,
    estimatedInputTokens: number,
    provider?: string,
    outputRatio?: number,
  ): number {
    const ratio = outputRatio ?? 0.5;
    const price = this.lookup(modelId, provider);
    const inputCost = (estimatedInputTokens * price.inputPricePerMillion) / 1_000_000;
    const outputCost = (estimatedInputTokens * ratio * price.outputPricePerMillion) / 1_000_000;
    return inputCost + outputCost;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
