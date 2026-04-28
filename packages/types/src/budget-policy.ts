import { z } from 'zod';
import { BudgetScope, BudgetScopeSchema } from './budget-scope.js';
import { DowngradeRule, DowngradeRuleSchema } from './downgrade-rule.js';

export interface BudgetPolicy {
  softCap: number;
  hardCap: number;
  autoDowngrade: DowngradeRule[];
  disableTools: string[];
}

export const BudgetPolicySchema = z.object({
  softCap: z.number().min(0).max(1).default(0.8),
  hardCap: z.number().min(0).max(1).default(1.0),
  autoDowngrade: z.array(DowngradeRuleSchema).default([]),
  disableTools: z.array(z.string()).default([]),
});

export interface BudgetDefinition {
  scopeType: BudgetScope;
  scopeKey: string;
  limit: number;
  policy: BudgetPolicy;
}

export const BudgetDefinitionSchema = z.object({
  scopeType: BudgetScopeSchema,
  scopeKey: z.string().min(1),
  limit: z.number().positive(),
  policy: BudgetPolicySchema,
});
