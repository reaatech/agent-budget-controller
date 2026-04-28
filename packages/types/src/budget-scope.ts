import { z } from 'zod';

export enum BudgetScope {
  Task = 'task',
  User = 'user',
  Session = 'session',
  Org = 'org',
}

export const BudgetScopeSchema = z.nativeEnum(BudgetScope);

export interface ScopeIdentifier {
  scopeType: BudgetScope;
  scopeKey: string;
}

export const ScopeIdentifierSchema = z.object({
  scopeType: BudgetScopeSchema,
  scopeKey: z.string().min(1),
});

export type ScopeResolver<TContext = unknown> = (context: TContext) => ScopeIdentifier | null;
