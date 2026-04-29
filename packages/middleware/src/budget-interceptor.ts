import {
  BudgetScope,
  type ScopeIdentifier,
  BudgetExceededError,
  BudgetValidationError,
} from '@reaatech/agent-budget-types';
import { BudgetController } from '@reaatech/agent-budget-engine';

export interface InterceptorContext {
  scope: ScopeIdentifier;
  allowed: boolean;
  modelId: string;
  tools: string[];
  originalModelId: string;
  originalTools: string[];
  reason?: string;
  warning?: string;
}

export interface InterceptorAfterContext extends InterceptorContext {
  actualCost: number;
  inputTokens: number;
  outputTokens: number;
  requestId: string;
  provider?: string;
}

export interface BudgetInterceptorOptions {
  controller: BudgetController;
}

export class BudgetInterceptor {
  constructor(private options: BudgetInterceptorOptions) {}

  beforeStep(params: {
    scope: ScopeIdentifier;
    modelId: string;
    tools: string[];
    estimatedCost?: number;
  }): InterceptorContext {
    const estimatedCost = params.estimatedCost ?? 0;
    const result = this.options.controller.check({
      scopeType: params.scope.scopeType,
      scopeKey: params.scope.scopeKey,
      estimatedCost,
      modelId: params.modelId,
      tools: params.tools,
    });

    const context: InterceptorContext = {
      scope: params.scope,
      allowed: result.allowed,
      modelId: result.suggestedModel ?? params.modelId,
      tools: params.tools.filter((t) => !result.disabledTools.includes(t)),
      originalModelId: params.modelId,
      originalTools: [...params.tools],
      reason: result.reason,
      warning: result.warning,
    };

    if (!result.allowed) {
      throw new BudgetExceededError(
        result.reason ?? 'Budget exceeded',
        params.scope,
        result.limit - result.remaining,
        result.limit,
        result.remaining,
        'hard-stop',
      );
    }

    return context;
  }

  afterStep(params: InterceptorAfterContext): void {
    this.options.controller.record({
      requestId: params.requestId,
      scopeType: params.scope.scopeType,
      scopeKey: params.scope.scopeKey,
      cost: params.actualCost,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      modelId: params.modelId,
      provider: params.provider ?? 'unknown',
      timestamp: new Date(),
    });
  }
}

export function createBudgetMiddleware(options: BudgetInterceptorOptions) {
  const interceptor = new BudgetInterceptor(options);

  return function budgetMiddleware(req: {
    headers: Record<string, string | string[] | undefined>;
    on?: (event: string, listener: (...args: unknown[]) => void) => void;
  }): {
    beforeStep: (params: {
      modelId: string;
      tools: string[];
      estimatedCost?: number;
    }) => InterceptorContext;
    afterStep: (params: {
      actualCost: number;
      inputTokens: number;
      outputTokens: number;
      requestId: string;
      provider?: string;
    }) => void;
  } {
    const scopeType = (req.headers['x-budget-scope-type'] as string) ?? 'user';
    const scopeKey = (req.headers['x-budget-scope-key'] as string) ?? 'default';

    if (!Object.values(BudgetScope).includes(scopeType as BudgetScope)) {
      throw new BudgetValidationError(
        `Invalid budget scope type: ${scopeType}`,
        'x-budget-scope-type',
      );
    }

    const scope: ScopeIdentifier = {
      scopeType: scopeType as BudgetScope,
      scopeKey,
    };

    let beforeContext: InterceptorContext | null = null;

    return {
      beforeStep: (params) => {
        const ctx = interceptor.beforeStep({
          scope,
          modelId: params.modelId,
          tools: params.tools,
          estimatedCost: params.estimatedCost,
        });
        beforeContext = ctx;
        return ctx;
      },
      afterStep: (params) => {
        const ctx: InterceptorAfterContext = {
          scope,
          allowed: beforeContext?.allowed ?? true,
          modelId: beforeContext?.modelId ?? 'unknown',
          tools: beforeContext?.tools ?? [],
          originalModelId: beforeContext?.originalModelId ?? 'unknown',
          originalTools: beforeContext?.originalTools ?? [],
          actualCost: params.actualCost,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          requestId: params.requestId,
          provider: params.provider,
        };
        interceptor.afterStep(ctx);
      },
    };
  };
}
