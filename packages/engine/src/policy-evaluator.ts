import type { BudgetPolicy } from '@reaatech/agent-budget-types';
import { EnforcementAction } from '@reaatech/agent-budget-types';

export interface PolicyEvaluation {
  action: EnforcementAction;
  triggeredThresholds: number[];
  suggestedModel?: string;
  disabledTools: string[];
  warning?: string;
}

export class PolicyEvaluator {
  evaluate(
    spent: number,
    limit: number,
    policy: BudgetPolicy,
    currentModel?: string,
    currentTools?: string[],
  ): PolicyEvaluation {
    const utilization = limit > 0 ? spent / limit : Number.POSITIVE_INFINITY;
    const triggeredThresholds: number[] = [];

    if (limit === 0 || utilization >= policy.hardCap) {
      return {
        action: EnforcementAction.HardStop,
        triggeredThresholds: [policy.hardCap],
        disabledTools: policy.disableTools,
        warning: `Hard cap reached (${(utilization * 100).toFixed(1)}% spent)`,
      };
    }

    if (utilization >= policy.softCap) {
      triggeredThresholds.push(policy.softCap);
      let suggestedModel: string | undefined;

      if (currentModel) {
        for (const rule of policy.autoDowngrade) {
          if (rule.from.includes('*') || rule.from.includes(currentModel)) {
            suggestedModel = rule.to;
            break;
          }
        }
      }

      const disabledTools = policy.disableTools;

      if (suggestedModel) {
        return {
          action: EnforcementAction.Degrade,
          triggeredThresholds,
          suggestedModel,
          disabledTools,
          warning: `Soft cap reached (${(utilization * 100).toFixed(1)}% spent). Model downgraded to ${suggestedModel}.`,
        };
      }

      if (
        disabledTools.length > 0 &&
        currentTools &&
        currentTools.some((t) => disabledTools.includes(t))
      ) {
        return {
          action: EnforcementAction.DisableTools,
          triggeredThresholds,
          disabledTools,
          warning: `Soft cap reached (${(utilization * 100).toFixed(1)}% spent). Expensive tools disabled.`,
        };
      }

      return {
        action: EnforcementAction.Warn,
        triggeredThresholds,
        disabledTools,
        warning: `Soft cap reached (${(utilization * 100).toFixed(1)}% spent)`,
      };
    }

    return {
      action: EnforcementAction.Allow,
      triggeredThresholds,
      disabledTools: [],
    };
  }
}
