import {
  BudgetScope,
  BudgetState,
  BudgetStateEnum,
  BudgetDefinition,
  BudgetCheckRequest,
  BudgetCheckResult,
  SpendEntry,
  EnforcementAction,
  BudgetErrorCode,
  BudgetError,
} from '@reaatech/agent-budget-types';
import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import { PolicyEvaluator } from './policy-evaluator.js';
import { DowngradeEngine } from './downgrade-engine.js';
import { ToolFilter } from './tool-filter.js';

export interface PricingProvider {
  estimateCost(modelId: string, estimatedInputTokens: number, provider?: string): number;
}

export interface BudgetControllerOptions {
  spendTracker: SpendStore;
  pricing?: PricingProvider;
  defaultEstimateTokens?: number;
}

export interface BudgetEvent {
  scopeType: BudgetScope;
  scopeKey: string;
  timestamp: Date;
}

export interface ThresholdBreachEvent extends BudgetEvent {
  threshold: number;
  spent: number;
  limit: number;
  action: EnforcementAction;
}

export interface StateChangeEvent extends BudgetEvent {
  from: BudgetStateEnum;
  to: BudgetStateEnum;
  reason: string;
}

export interface HardStopEvent extends BudgetEvent {
  spent: number;
  limit: number;
}

export type BudgetResetEvent = BudgetEvent;

export interface BudgetEventMap {
  'state-change': StateChangeEvent;
  'threshold-breach': ThresholdBreachEvent;
  'hard-stop': HardStopEvent;
  'budget-reset': BudgetResetEvent;
}

const WILDCARD_KEY = '*';

export class BudgetController {
  private budgets = new Map<string, BudgetDefinition>();
  private states = new Map<string, BudgetState>();
  private evaluator = new PolicyEvaluator();
  private downgradeEngine = new DowngradeEngine();
  private toolFilter = new ToolFilter();
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  constructor(private options: BudgetControllerOptions) {}

  defineBudget(definition: BudgetDefinition): void {
    this.validateDefinition(definition);
    const key = this.scopeKey(definition.scopeType, definition.scopeKey);
    if (this.budgets.has(key) && definition.scopeKey !== WILDCARD_KEY) {
      throw new BudgetError(
        `Budget already defined for scope ${definition.scopeType}:${definition.scopeKey}`,
        BudgetErrorCode.Validation,
        { scopeType: definition.scopeType, scopeKey: definition.scopeKey },
      );
    }
    this.budgets.set(key, definition);
    this.states.set(key, this.createInitialState(definition));
  }

  undefineBudget(scopeType: BudgetScope, scopeKey: string): void {
    const key = this.scopeKey(scopeType, scopeKey);
    this.budgets.delete(key);
    this.states.delete(key);
  }

  getBudget(scopeType: BudgetScope, scopeKey: string): BudgetDefinition | undefined {
    const resolved = this.resolveBudget(scopeType, scopeKey);
    if (!resolved) return undefined;
    return {
      ...resolved,
      policy: {
        ...resolved.policy,
        autoDowngrade: resolved.policy.autoDowngrade.map((r) => ({ ...r })),
      },
    };
  }

  check(request: BudgetCheckRequest): BudgetCheckResult {
    const budget = this.resolveBudget(request.scopeType, request.scopeKey);
    if (!budget) {
      return {
        allowed: true,
        action: EnforcementAction.Allow,
        remaining: Number.POSITIVE_INFINITY,
        limit: Number.POSITIVE_INFINITY,
        estimatedCost: request.estimatedCost,
        disabledTools: [],
      };
    }

    this.getOrCreateState(budget, request.scopeKey);

    let estimatedCost = request.estimatedCost;
    if (estimatedCost === 0 && this.options.pricing) {
      estimatedCost = this.options.pricing.estimateCost(
        request.modelId,
        this.options.defaultEstimateTokens ?? 1000,
      );
    }

    const currentSpend = this.options.spendTracker.getSpend(request.scopeType, request.scopeKey);
    const spent = currentSpend + estimatedCost;

    const evaluation = this.evaluator.evaluate(
      spent,
      budget.limit,
      budget.policy,
      request.modelId,
      request.tools,
    );

    const remaining = Math.max(0, budget.limit - spent);

    if (evaluation.action === EnforcementAction.HardStop) {
      return {
        allowed: false,
        action: evaluation.action,
        remaining,
        limit: budget.limit,
        estimatedCost,
        disabledTools: evaluation.disabledTools,
        warning: evaluation.warning,
        reason: 'Hard cap exceeded',
      };
    }

    const filtered = this.toolFilter.filter(request.tools, evaluation.disabledTools);

    return {
      allowed: true,
      action: evaluation.action,
      remaining,
      limit: budget.limit,
      estimatedCost,
      suggestedModel: evaluation.suggestedModel,
      disabledTools: filtered.disabled,
      warning: evaluation.warning,
    };
  }

  record(entry: SpendEntry): void {
    this.options.spendTracker.record(entry);
    const budget = this.resolveBudget(entry.scopeType, entry.scopeKey);
    if (!budget) return;

    const state = this.getOrCreateState(budget, entry.scopeKey);
    const spent = this.options.spendTracker.getSpend(entry.scopeType, entry.scopeKey);
    state.spent = spent;
    state.remaining = Math.max(0, budget.limit - spent);
    state.lastUpdated = new Date();

    const evaluation = this.evaluator.evaluate(spent, budget.limit, budget.policy, entry.modelId);
    const newState = this.determineState(evaluation.action);

    if (newState !== state.state) {
      const from = state.state;
      state.state = newState;
      this.emit('state-change', {
        scopeType: entry.scopeType,
        scopeKey: entry.scopeKey,
        from,
        to: newState,
        reason: evaluation.warning ?? 'Threshold crossed',
        timestamp: new Date(),
      });
    }

    for (const threshold of evaluation.triggeredThresholds) {
      this.emit('threshold-breach', {
        scopeType: entry.scopeType,
        scopeKey: entry.scopeKey,
        threshold,
        spent,
        limit: budget.limit,
        action: evaluation.action,
        timestamp: new Date(),
      });
    }

    if (evaluation.action === EnforcementAction.HardStop) {
      this.emit('hard-stop', {
        scopeType: entry.scopeType,
        scopeKey: entry.scopeKey,
        spent,
        limit: budget.limit,
        timestamp: new Date(),
      });
    }
  }

  getState(scopeType: BudgetScope, scopeKey: string): BudgetState | undefined {
    const budget = this.resolveBudget(scopeType, scopeKey);
    if (!budget) return undefined;
    const state = this.getOrCreateState(budget, scopeKey);
    return state ? { ...state } : undefined;
  }

  suggestDowngrade(
    currentModel: string,
    scopeType: BudgetScope,
    scopeKey: string,
  ): string | undefined {
    const budget = this.resolveBudget(scopeType, scopeKey);
    if (!budget) return undefined;
    return this.downgradeEngine.suggestDowngrade(currentModel, budget.policy.autoDowngrade);
  }

  getDisabledTools(scopeType: BudgetScope, scopeKey: string): string[] {
    const budget = this.resolveBudget(scopeType, scopeKey);
    return budget?.policy.disableTools ?? [];
  }

  reset(scopeType: BudgetScope, scopeKey: string): void {
    const budget = this.resolveBudget(scopeType, scopeKey);
    if (!budget) return;

    const state = this.getOrCreateState(budget, scopeKey);
    const from = state.state;
    state.spent = 0;
    state.remaining = budget.limit;
    state.state = BudgetStateEnum.Active;
    state.lastThreshold = undefined;
    state.breachCount = 0;
    state.lastReset = new Date();
    state.lastUpdated = new Date();

    this.emit('budget-reset', {
      scopeType: budget.scopeType,
      scopeKey,
      timestamp: new Date(),
    });

    if (from !== BudgetStateEnum.Active) {
      this.emit('state-change', {
        scopeType: budget.scopeType,
        scopeKey,
        from,
        to: BudgetStateEnum.Active,
        reason: 'Budget reset',
        timestamp: new Date(),
      });
    }
  }

  listAll(): Array<{ definition: BudgetDefinition; state: BudgetState | undefined }> {
    const results: Array<{ definition: BudgetDefinition; state: BudgetState | undefined }> = [];
    for (const [key, definition] of this.budgets) {
      const state = this.states.get(key);
      results.push({
        definition: { ...definition },
        state: state ? { ...state } : undefined,
      });
    }
    return results;
  }

  on<K extends keyof BudgetEventMap>(event: K, callback: (event: BudgetEventMap[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as unknown as (...args: unknown[]) => void);
  }

  off<K extends keyof BudgetEventMap>(
    event: K,
    callback: (event: BudgetEventMap[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(callback as unknown as (...args: unknown[]) => void);
  }

  private emit<K extends keyof BudgetEventMap>(event: K, data: BudgetEventMap[K]): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    for (const cb of callbacks) {
      try {
        cb(data);
      } catch (err) {
        console.error(`[BudgetController] listener error for event "${event}":`, err);
      }
    }
  }

  private resolveBudget(scopeType: BudgetScope, scopeKey: string): BudgetDefinition | undefined {
    const exact = this.budgets.get(this.scopeKey(scopeType, scopeKey));
    if (exact) return exact;

    const wildcardKey = this.scopeKey(scopeType, WILDCARD_KEY);
    const wildcard = this.budgets.get(wildcardKey);
    if (wildcard) return wildcard;

    const globalWildcard = this.scopeKey(BudgetScope.User, WILDCARD_KEY);
    return this.budgets.get(globalWildcard);
  }

  private validateDefinition(definition: BudgetDefinition): void {
    if (!Object.values(BudgetScope).includes(definition.scopeType)) {
      throw new BudgetError(
        `Invalid scope type: ${definition.scopeType}`,
        BudgetErrorCode.Validation,
      );
    }
    if (definition.scopeKey.length === 0) {
      throw new BudgetError('scopeKey must not be empty', BudgetErrorCode.Validation);
    }
    if (definition.limit <= 0) {
      throw new BudgetError('limit must be positive', BudgetErrorCode.Validation);
    }
    if (definition.policy.softCap > definition.policy.hardCap) {
      throw new BudgetError('softCap must not exceed hardCap', BudgetErrorCode.Validation);
    }
  }

  private createInitialState(definition: BudgetDefinition): BudgetState {
    return {
      scopeType: definition.scopeType,
      scopeKey: definition.scopeKey,
      limit: definition.limit,
      spent: 0,
      remaining: definition.limit,
      policy: definition.policy,
      state: BudgetStateEnum.Active,
      breachCount: 0,
      lastUpdated: new Date(),
    };
  }

  private getOrCreateState(budget: BudgetDefinition, actualScopeKey: string): BudgetState {
    const key = this.scopeKey(budget.scopeType, actualScopeKey);
    let state = this.states.get(key);
    if (!state) {
      state = this.createInitialState({
        ...budget,
        scopeKey: actualScopeKey,
      });
      this.states.set(key, state);
    }
    return state;
  }

  private determineState(action: EnforcementAction): BudgetStateEnum {
    switch (action) {
      case EnforcementAction.Allow:
        return BudgetStateEnum.Active;
      case EnforcementAction.Warn:
        return BudgetStateEnum.Warned;
      case EnforcementAction.Degrade:
      case EnforcementAction.DisableTools:
        return BudgetStateEnum.Degraded;
      case EnforcementAction.HardStop:
        return BudgetStateEnum.Stopped;
    }
  }

  private scopeKey(scopeType: BudgetScope, scopeKey: string): string {
    return `${scopeType}:${scopeKey}`;
  }
}
