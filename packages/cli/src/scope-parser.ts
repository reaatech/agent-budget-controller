import { BudgetScope } from '@agent-budget-controller/types';

export interface ParsedScope {
  scopeType: BudgetScope;
  scopeKey: string;
}

export function parseScope(input: string): ParsedScope {
  const parts = input.split(':');
  if (parts.length < 2) {
    throw new Error(`Invalid scope format: ${input}. Expected "type:key"`);
  }
  const scopeType = parts[0] as BudgetScope;
  const scopeKey = parts.slice(1).join(':');
  if (!Object.values(BudgetScope).includes(scopeType)) {
    throw new Error(`Invalid scope type: ${scopeType}`);
  }
  return { scopeType, scopeKey };
}
