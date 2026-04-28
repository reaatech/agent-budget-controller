import { BudgetScope, type SpendEntry } from '@agent-budget-controller/types';
import { BudgetController } from '@agent-budget-controller/budget-engine';

export interface SpanListenerOptions {
  controller: BudgetController;
  scopeExtractor?: (
    attributes: Record<string, unknown>,
  ) => { scopeType: BudgetScope; scopeKey: string } | null;
}

function toBudgetScope(value: string): BudgetScope | null {
  if (Object.values(BudgetScope).includes(value as BudgetScope)) {
    return value as BudgetScope;
  }
  return null;
}

export class SpanListener {
  constructor(private options: SpanListenerOptions) {}

  onSpanEnd(
    attributes: Record<string, unknown>,
    overrides: {
      requestId?: string;
      cost?: number;
      inputTokens?: number;
      outputTokens?: number;
      modelId?: string;
      provider?: string;
      timestamp?: Date;
    } = {},
  ): void {
    const extractor = this.options.scopeExtractor ?? this.defaultScopeExtractor;
    const scope = extractor(attributes);
    if (!scope) return;

    const entry: SpendEntry = {
      requestId: overrides.requestId ?? (attributes['request.id'] as string) ?? 'unknown',
      scopeType: scope.scopeType,
      scopeKey: scope.scopeKey,
      cost: overrides.cost ?? this.extractCost(attributes),
      inputTokens:
        overrides.inputTokens ?? (attributes['gen_ai.usage.input_tokens'] as number) ?? 0,
      outputTokens:
        overrides.outputTokens ?? (attributes['gen_ai.usage.output_tokens'] as number) ?? 0,
      modelId: overrides.modelId ?? (attributes['gen_ai.request.model'] as string) ?? 'unknown',
      provider: overrides.provider ?? (attributes['gen_ai.system'] as string) ?? 'unknown',
      timestamp: overrides.timestamp ?? new Date(),
    };

    this.options.controller.record(entry);
  }

  private defaultScopeExtractor(
    attributes: Record<string, unknown>,
  ): { scopeType: BudgetScope; scopeKey: string } | null {
    const scopeTypeStr = attributes['budget.scope_type'] as string | undefined;
    const scopeKey = attributes['budget.scope_key'] as string | undefined;
    if (!scopeTypeStr || !scopeKey) return null;
    const scopeType = toBudgetScope(scopeTypeStr);
    if (!scopeType) return null;
    return { scopeType, scopeKey };
  }

  private extractCost(attributes: Record<string, unknown>): number {
    const cost = attributes['llm.cost.total_usd'] as number | undefined;
    if (cost !== undefined) return cost;
    const inputCost = (attributes['llm.cost.input_tokens_usd'] as number) ?? 0;
    const outputCost = (attributes['llm.cost.output_tokens_usd'] as number) ?? 0;
    return inputCost + outputCost;
  }
}
