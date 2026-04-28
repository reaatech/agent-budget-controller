import { ToolFilterResult } from '@agent-budget-controller/types';

export class ToolFilter {
  filter(tools: string[], disabledTools: string[]): ToolFilterResult {
    const disabled = tools.filter((t) => disabledTools.includes(t));
    const filtered = tools.filter((t) => !disabledTools.includes(t));
    return { original: tools, filtered, disabled };
  }
}
