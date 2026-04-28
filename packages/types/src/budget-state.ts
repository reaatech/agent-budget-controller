import { z } from 'zod';
import { BudgetScope, BudgetScopeSchema } from './budget-scope.js';
import { BudgetStateEnum, BudgetStateEnumSchema } from './enforcement.js';
import { BudgetPolicy, BudgetPolicySchema } from './budget-policy.js';

export interface BudgetState {
  scopeType: BudgetScope;
  scopeKey: string;
  limit: number;
  spent: number;
  remaining: number;
  policy: BudgetPolicy;
  state: BudgetStateEnum;
  lastThreshold?: number;
  breachCount: number;
  lastReset?: Date;
  lastUpdated: Date;
}

export const BudgetStateSchema = z.object({
  scopeType: BudgetScopeSchema,
  scopeKey: z.string().min(1),
  limit: z.number().nonnegative(),
  spent: z.number().nonnegative(),
  remaining: z.number(),
  policy: BudgetPolicySchema,
  state: BudgetStateEnumSchema,
  lastThreshold: z.number().optional(),
  breachCount: z.number().int().nonnegative(),
  lastReset: z.date().optional(),
  lastUpdated: z.date(),
});

export interface BudgetSnapshot {
  scopeType: BudgetScope;
  scopeKey: string;
  limit: number;
  spent: number;
  remaining: number;
  utilization: number;
  state: BudgetStateEnum;
  lastUpdated: Date;
}

export const BudgetSnapshotSchema = z.object({
  scopeType: BudgetScopeSchema,
  scopeKey: z.string(),
  limit: z.number(),
  spent: z.number(),
  remaining: z.number(),
  utilization: z.number(),
  state: BudgetStateEnumSchema,
  lastUpdated: z.date(),
});
