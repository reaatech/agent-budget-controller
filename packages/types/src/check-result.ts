import { z } from 'zod';
import { type BudgetScope, BudgetScopeSchema } from './budget-scope.js';
import { type EnforcementAction, EnforcementActionSchema } from './enforcement.js';

export interface BudgetCheckRequest {
  scopeType: BudgetScope;
  scopeKey: string;
  estimatedCost: number;
  modelId: string;
  tools: string[];
}

export const BudgetCheckRequestSchema = z.object({
  scopeType: BudgetScopeSchema,
  scopeKey: z.string().min(1),
  estimatedCost: z.number().nonnegative(),
  modelId: z.string(),
  tools: z.array(z.string()).default([]),
});

export interface BudgetCheckResult {
  allowed: boolean;
  action: EnforcementAction;
  remaining: number;
  limit: number;
  estimatedCost: number;
  suggestedModel?: string;
  disabledTools: string[];
  warning?: string;
  reason?: string;
}

export const BudgetCheckResultSchema = z.object({
  allowed: z.boolean(),
  action: EnforcementActionSchema,
  remaining: z.number(),
  limit: z.number().nonnegative(),
  estimatedCost: z.number().nonnegative(),
  suggestedModel: z.string().optional(),
  disabledTools: z.array(z.string()).default([]),
  warning: z.string().optional(),
  reason: z.string().optional(),
});
