import { z } from 'zod';
import { ScopeIdentifier, ScopeIdentifierSchema } from './budget-scope.js';

export enum EnforcementAction {
  Allow = 'allow',
  Warn = 'warn',
  Degrade = 'degrade',
  DisableTools = 'disable-tools',
  HardStop = 'hard-stop',
}

export const EnforcementActionSchema = z.nativeEnum(EnforcementAction);

export enum BudgetStateEnum {
  Active = 'active',
  Warned = 'warned',
  Degraded = 'degraded',
  Stopped = 'stopped',
}

export const BudgetStateEnumSchema = z.nativeEnum(BudgetStateEnum);

export interface StateTransition {
  scope: ScopeIdentifier;
  from: BudgetStateEnum;
  to: BudgetStateEnum;
  reason: string;
  timestamp: Date;
}

export const StateTransitionSchema = z.object({
  scope: ScopeIdentifierSchema,
  from: BudgetStateEnumSchema,
  to: BudgetStateEnumSchema,
  reason: z.string(),
  timestamp: z.date(),
});

export interface EnforcementResult {
  action: EnforcementAction;
  allowed: boolean;
  suggestedModel?: string;
  disabledTools: string[];
  warning?: string;
  reason?: string;
}

export const EnforcementResultSchema = z.object({
  action: EnforcementActionSchema,
  allowed: z.boolean(),
  suggestedModel: z.string().optional(),
  disabledTools: z.array(z.string()).default([]),
  warning: z.string().optional(),
  reason: z.string().optional(),
});
