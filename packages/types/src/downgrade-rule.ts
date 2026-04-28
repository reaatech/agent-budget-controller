import { z } from 'zod';

export interface DowngradeRule {
  from: string[];
  to: string;
}

export const DowngradeRuleSchema = z.object({
  from: z.array(z.string()).min(1),
  to: z.string().min(1),
});
