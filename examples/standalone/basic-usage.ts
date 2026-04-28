import { BudgetController } from '@agent-budget-controller/budget-engine';
import { SpendStore } from '@agent-budget-controller/spend-tracker';
import { BudgetInterceptor } from '@agent-budget-controller/middleware';
import { BudgetScope, BudgetExceededError } from '@agent-budget-controller/types';

const spendTracker = new SpendStore({ maxEntries: 500_000 });
const controller = new BudgetController({ spendTracker });

controller.defineBudget({
  scopeType: BudgetScope.User,
  scopeKey: 'user-123',
  limit: 10.0,
  policy: {
    softCap: 0.8,
    hardCap: 1.0,
    autoDowngrade: [
      { from: ['claude-opus-4-1'], to: 'claude-sonnet-4' },
      { from: ['claude-sonnet-4'], to: 'claude-haiku-3-5' },
    ],
    disableTools: ['web-search', 'code-exec'],
  },
});

controller.on('state-change', (event) => {
  console.log(
    `[STATE] ${event.scopeType}:${event.scopeKey} ${event.from} -> ${event.to} (${event.reason})`,
  );
});

controller.on('threshold-breach', (event) => {
  console.log(
    `[THRESHOLD] ${event.scopeType}:${event.scopeKey} ${(event.threshold * 100).toFixed(0)}% ` +
      `spent=${event.spent.toFixed(2)}/${event.limit.toFixed(2)}`,
  );
});

controller.on('hard-stop', (event) => {
  console.log(
    `[HARD-STOP] ${event.scopeType}:${event.scopeKey} spent=${event.spent.toFixed(2)}/${event.limit.toFixed(2)}`,
  );
});

const interceptor = new BudgetInterceptor({ controller });

function simulateLLMCall(
  modelId: string,
  _prompt: string,
  _tools: string[],
): {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
} {
  const costs: Record<string, { input: number; output: number }> = {
    'claude-opus-4-1': { input: 15.0, output: 75.0 },
    'claude-sonnet-4': { input: 3.0, output: 15.0 },
    'claude-haiku-3-5': { input: 0.25, output: 1.25 },
  };
  const p = costs[modelId] ?? { input: 1.0, output: 5.0 };
  const inputTokens = 500;
  const outputTokens = 200;
  return {
    cost: (inputTokens * p.input + outputTokens * p.output) / 1_000_000,
    inputTokens,
    outputTokens,
    modelId,
  };
}

async function agentLoop(iterations: number): Promise<void> {
  for (let i = 0; i < iterations; i++) {
    try {
      const ctx = interceptor.beforeStep({
        scope: { scopeType: BudgetScope.User, scopeKey: 'user-123' },
        modelId: 'claude-opus-4-1',
        tools: ['web-search', 'file-read'],
        estimatedCost: 0.01,
      });

      console.log(
        `[STEP ${i + 1}] model=${ctx.modelId} tools=${ctx.tools.join(',')} ` +
          `allowed=${ctx.allowed} ${ctx.warning ?? ''}`,
      );

      const response = simulateLLMCall(ctx.modelId, 'test prompt', ctx.tools);

      interceptor.afterStep({
        ...ctx,
        actualCost: response.cost,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        requestId: `req-${i + 1}`,
      });

      const state = controller.getState(BudgetScope.User, 'user-123');
      console.log(
        `  spent=$${state!.spent.toFixed(4)} remaining=$${state!.remaining.toFixed(4)} ` +
          `state=${state!.state}`,
      );
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        console.log(`[BLOCKED] ${err.message} (spent=${err.spent}/${err.limit})`);
        break;
      }
      throw err;
    }
  }
}

agentLoop(15).catch(console.error);
