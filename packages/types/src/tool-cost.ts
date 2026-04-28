import { z } from 'zod';

export interface ToolCostConfig {
  toolName: string;
  costWeight: number;
}

export const ToolCostConfigSchema = z.object({
  toolName: z.string().min(1),
  costWeight: z.number().positive(),
});

export interface ToolFilterResult {
  original: string[];
  filtered: string[];
  disabled: string[];
}

export const ToolFilterResultSchema = z.object({
  original: z.array(z.string()),
  filtered: z.array(z.string()),
  disabled: z.array(z.string()),
});
