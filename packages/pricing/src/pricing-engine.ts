import { BudgetError, BudgetErrorCode } from '@reaatech/agent-budget-types';
import { ModelNormalizer } from './model-normalizer.js';
import { anthropicPricing } from './tables/anthropic.js';
import { awsBedrockPricing } from './tables/aws-bedrock.js';
import { deepseekPricing } from './tables/deepseek.js';
import { googlePricing } from './tables/google.js';
import { openaiPricing } from './tables/openai.js';

export interface PriceEntry {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cacheReadPricePerMillion?: number;
  cacheWritePricePerMillion?: number;
}

export interface ComputeCostOptions {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  provider?: string;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface EstimateCostOptions {
  modelId: string;
  estimatedInputTokens: number;
  provider?: string;
  outputRatio?: number;
  cacheReadRatio?: number;
  cacheWriteRatio?: number;
}

export interface LoadTableOptions {
  provider: string;
  models: Record<string, PriceEntry>;
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
    this.loadTable(deepseekPricing.provider, deepseekPricing.models);
  }

  loadTable(provider: string, models: Record<string, PriceEntry>): void;
  loadTable(options: LoadTableOptions): void;
  loadTable(
    providerOrOptions: string | LoadTableOptions,
    models?: Record<string, PriceEntry>,
  ): void {
    let provider: string;
    let resolvedModels: Record<string, PriceEntry>;
    if (typeof providerOrOptions === 'object') {
      provider = providerOrOptions.provider;
      resolvedModels = providerOrOptions.models;
    } else {
      provider = providerOrOptions;
      if (!models) {
        throw new BudgetError(
          'models is required when provider is a string',
          BudgetErrorCode.Validation,
        );
      }
      resolvedModels = models;
    }
    const map = new Map<string, PriceEntry>();
    for (const [modelId, entry] of Object.entries(resolvedModels)) {
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
    cacheReadTokens?: number,
    cacheWriteTokens?: number,
  ): number;
  computeCost(options: ComputeCostOptions): number;
  computeCost(
    inputTokensOrOptions: number | ComputeCostOptions,
    outputTokens?: number,
    modelId?: string,
    provider?: string,
    cacheReadTokens?: number,
    cacheWriteTokens?: number,
  ): number {
    let inputTokens: number;
    let outputTokens_: number;
    let modelId_: string;
    let provider_: string | undefined;
    let cacheReadTokens_: number | undefined;
    let cacheWriteTokens_: number | undefined;

    if (typeof inputTokensOrOptions === 'object') {
      const opts = inputTokensOrOptions;
      inputTokens = opts.inputTokens;
      outputTokens_ = opts.outputTokens;
      modelId_ = opts.modelId;
      provider_ = opts.provider;
      cacheReadTokens_ = opts.cacheReadTokens;
      cacheWriteTokens_ = opts.cacheWriteTokens;
    } else {
      if (outputTokens === undefined || modelId === undefined) {
        throw new BudgetError('outputTokens and modelId are required', BudgetErrorCode.Validation);
      }
      inputTokens = inputTokensOrOptions;
      outputTokens_ = outputTokens;
      modelId_ = modelId;
      provider_ = provider;
      cacheReadTokens_ = cacheReadTokens;
      cacheWriteTokens_ = cacheWriteTokens;
    }

    const price = this.lookup(modelId_, provider_);
    const inputCost = (inputTokens * price.inputPricePerMillion) / 1_000_000;
    const outputCost = (outputTokens_ * price.outputPricePerMillion) / 1_000_000;
    const cacheReadPrice = price.cacheReadPricePerMillion ?? price.inputPricePerMillion;
    const cacheWritePrice = price.cacheWritePricePerMillion ?? price.inputPricePerMillion;
    const cacheReadCost =
      cacheReadTokens_ != null ? (cacheReadTokens_ * cacheReadPrice) / 1_000_000 : 0;
    const cacheWriteCost =
      cacheWriteTokens_ != null ? (cacheWriteTokens_ * cacheWritePrice) / 1_000_000 : 0;
    return inputCost + outputCost + cacheReadCost + cacheWriteCost;
  }

  estimateCost(
    modelId: string,
    estimatedInputTokens: number,
    provider?: string,
    outputRatio?: number,
    cacheReadRatio?: number,
    cacheWriteRatio?: number,
  ): number;
  estimateCost(options: EstimateCostOptions): number;
  estimateCost(
    modelIdOrOptions: string | EstimateCostOptions,
    estimatedInputTokens?: number,
    provider?: string,
    outputRatio?: number,
    cacheReadRatio?: number,
    cacheWriteRatio?: number,
  ): number {
    let modelId_: string;
    let estimatedInputTokens_: number;
    let provider_: string | undefined;
    let outputRatio_: number | undefined;
    let cacheReadRatio_: number | undefined;
    let cacheWriteRatio_: number | undefined;

    if (typeof modelIdOrOptions === 'object') {
      const opts = modelIdOrOptions;
      modelId_ = opts.modelId;
      estimatedInputTokens_ = opts.estimatedInputTokens;
      provider_ = opts.provider;
      outputRatio_ = opts.outputRatio;
      cacheReadRatio_ = opts.cacheReadRatio;
      cacheWriteRatio_ = opts.cacheWriteRatio;
    } else {
      if (estimatedInputTokens === undefined) {
        throw new BudgetError('estimatedInputTokens is required', BudgetErrorCode.Validation);
      }
      modelId_ = modelIdOrOptions;
      estimatedInputTokens_ = estimatedInputTokens;
      provider_ = provider;
      outputRatio_ = outputRatio;
      cacheReadRatio_ = cacheReadRatio;
      cacheWriteRatio_ = cacheWriteRatio;
    }

    const ratio = outputRatio_ ?? 0.5;
    const price = this.lookup(modelId_, provider_);
    const inputCost = (estimatedInputTokens_ * price.inputPricePerMillion) / 1_000_000;
    const outputCost = (estimatedInputTokens_ * ratio * price.outputPricePerMillion) / 1_000_000;
    const cacheReadPrice = price.cacheReadPricePerMillion ?? price.inputPricePerMillion;
    const cacheWritePrice = price.cacheWritePricePerMillion ?? price.inputPricePerMillion;
    const cacheReadTokens = (cacheReadRatio_ ?? 0) * estimatedInputTokens_;
    const cacheWriteTokens = (cacheWriteRatio_ ?? 0) * estimatedInputTokens_;
    const cacheReadCost = (cacheReadTokens * cacheReadPrice) / 1_000_000;
    const cacheWriteCost = (cacheWriteTokens * cacheWritePrice) / 1_000_000;
    return inputCost + outputCost + cacheReadCost + cacheWriteCost;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
