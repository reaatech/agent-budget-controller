import type { BudgetSnapshot, BudgetState } from '@reaatech/agent-budget-types';

export function formatBudgetState(
  state: BudgetState | undefined,
  format: 'text' | 'json' = 'text',
): string {
  if (!state) return format === 'json' ? 'null' : 'No budget found';

  if (format === 'json') {
    return JSON.stringify(
      {
        scopeType: state.scopeType,
        scopeKey: state.scopeKey,
        limit: state.limit,
        spent: state.spent,
        remaining: state.remaining,
        state: state.state,
        lastUpdated: state.lastUpdated.toISOString(),
      },
      null,
      2,
    );
  }

  return [
    `Scope: ${state.scopeType}:${state.scopeKey}`,
    `Limit: $${state.limit.toFixed(2)}`,
    `Spent: $${state.spent.toFixed(2)}`,
    `Remaining: $${state.remaining.toFixed(2)}`,
    `State: ${state.state}`,
  ].join('\n');
}

export function formatSnapshotTable(states: BudgetSnapshot[]): string {
  const lines = ['SCOPE               LIMIT       SPENT       REMAINING     STATE    '];
  lines.push('-------------------------------------------------------------------');
  for (const s of states) {
    const scope = `${s.scopeType}:${s.scopeKey}`.padEnd(20);
    const limit = `$${s.limit.toFixed(2)}`.padStart(10);
    const spent = `$${s.spent.toFixed(2)}`.padStart(10);
    const remaining = `$${s.remaining.toFixed(2)}`.padStart(12);
    const state = s.state.padStart(8);
    lines.push(`${scope}${limit}${spent}${remaining}${state}`);
  }
  return lines.join('\n');
}
