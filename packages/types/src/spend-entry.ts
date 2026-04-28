import { z } from 'zod';
import { BudgetScope, BudgetScopeSchema } from './budget-scope.js';

export interface SpendEntry {
  requestId: string;
  scopeType: BudgetScope;
  scopeKey: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  provider: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export const SpendEntrySchema = z.object({
  requestId: z.string(),
  scopeType: BudgetScopeSchema,
  scopeKey: z.string().min(1),
  cost: z.number().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  modelId: z.string(),
  provider: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

export interface SpendQuery {
  scopeType?: BudgetScope;
  scopeKey?: string;
  modelId?: string;
  startTime?: Date;
  endTime?: Date;
}

export const SpendQuerySchema = z.object({
  scopeType: BudgetScopeSchema.optional(),
  scopeKey: z.string().optional(),
  modelId: z.string().optional(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
});
