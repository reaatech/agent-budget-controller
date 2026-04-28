import { BudgetScope } from '@agent-budget-controller/types';
import { BudgetController } from '@agent-budget-controller/budget-engine';

export interface RoutingModel {
  id: string;
  estimatedCost?: number;
}

export interface RoutingRequest {
  scopeType?: BudgetScope | string;
  scopeKey?: string;
  models: RoutingModel[];
}

export interface RoutingResult {
  models: RoutingModel[];
  blocked: boolean;
  reason?: string;
}

export interface BudgetStrategyOptions {
  controller: BudgetController;
  defaultScopeType?: BudgetScope;
}

export class BudgetAwareStrategy {
  readonly name = 'budget-aware';
  readonly priority = 1;

  constructor(private options: BudgetStrategyOptions) {}

  applies(): boolean {
    return true;
  }

  select(request: RoutingRequest): RoutingResult {
    const scopeType =
      request.scopeType && Object.values(BudgetScope).includes(request.scopeType as BudgetScope)
        ? (request.scopeType as BudgetScope)
        : (this.options.defaultScopeType ?? BudgetScope.User);
    const scopeKey = request.scopeKey ?? 'default';

    const checkResult = this.options.controller.check({
      scopeType,
      scopeKey,
      estimatedCost: 0,
      modelId: request.models[0]?.id ?? 'unknown',
      tools: [],
    });

    if (!checkResult.allowed) {
      return { models: [], blocked: true, reason: checkResult.reason };
    }

    const filtered = request.models.filter((m) => {
      if (!m.estimatedCost) return true;
      return m.estimatedCost <= checkResult.remaining;
    });

    return {
      models: filtered.length > 0 ? filtered : request.models,
      blocked: false,
    };
  }
}
