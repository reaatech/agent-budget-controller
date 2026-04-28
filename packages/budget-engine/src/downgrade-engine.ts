import { DowngradeRule } from '@agent-budget-controller/types';

export class DowngradeEngine {
  suggestDowngrade(currentModel: string, rules: DowngradeRule[]): string | undefined {
    for (const rule of rules) {
      if (rule.from.includes('*') || rule.from.includes(currentModel)) {
        return rule.to;
      }
    }
    return undefined;
  }

  getDowngradeChain(currentModel: string, rules: DowngradeRule[]): string[] {
    const chain: string[] = [];
    let model = currentModel;
    const seen = new Set<string>();

    while (!seen.has(model)) {
      seen.add(model);
      const next = this.suggestDowngrade(model, rules);
      if (!next || next === model) break;
      chain.push(next);
      model = next;
    }

    return chain;
  }
}
