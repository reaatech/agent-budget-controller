#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { BudgetController } from '@reaatech/agent-budget-engine';
import { PricingEngine } from '@reaatech/agent-budget-pricing';
import { SpendStore } from '@reaatech/agent-budget-spend-tracker';
import { BudgetScope } from '@reaatech/agent-budget-types';
import { Command } from 'commander';
import { formatBudgetState, formatSnapshotTable, parseScope } from './index.js';

const program = new Command();

program
  .name('agent-budget')
  .description('Real-time cost budget enforcement CLI for agent systems')
  .version('0.0.0');

program
  .command('check')
  .description('Check remaining budget for a scope')
  .argument('<scope>', 'Scope in format "type:key" (e.g. user:user-123)')
  .option('-e, --estimated-cost <cost>', 'Estimated cost for upcoming request', '0')
  .option('-c, --config <path>', 'Path to JSON budget configuration file')
  .option('-m, --model <model>', 'Model ID for cost estimation')
  .action((scope: string, options: { estimatedCost: string; config?: string; model?: string }) => {
    try {
      const parsed = parseScope(scope);
      if (!options.config) {
        console.log(
          JSON.stringify(
            {
              scopeType: parsed.scopeType,
              scopeKey: parsed.scopeKey,
              estimatedCost: Number(options.estimatedCost),
            },
            null,
            2,
          ),
        );
        console.log('(Use --config <path> with a JSON budget config for live checking)');
        return;
      }

      const config = JSON.parse(readFileSync(options.config, 'utf-8'));
      const definitions = Array.isArray(config) ? config : [config];
      const spendTracker = new SpendStore({ maxEntries: 500_000 });
      const pricing = new PricingEngine();
      const controller = new BudgetController({ spendTracker, pricing });

      for (const def of definitions) {
        controller.defineBudget(def);
      }

      const result = controller.check({
        scopeType: parsed.scopeType,
        scopeKey: parsed.scopeKey,
        estimatedCost: Number(options.estimatedCost),
        modelId: options.model ?? 'unknown',
        tools: [],
      });

      const state = controller.getState(parsed.scopeType, parsed.scopeKey);
      console.log(JSON.stringify({ ...result, state }, null, 2));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all active budgets from stdin input')
  .option('-f, --format <format>', 'Output format (table or json)', 'table')
  .action(async (options: { format: string }) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer);
      }
      const input = Buffer.concat(chunks).toString();
      const snapshots = JSON.parse(input);
      if (options.format === 'json') {
        console.log(JSON.stringify(snapshots, null, 2));
      } else {
        console.log(formatSnapshotTable(snapshots));
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate a spend report from stdin input')
  .option('-f, --format <format>', 'Output format (text or json)', 'text')
  .action(async (options: { format: string }) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer);
      }
      const input = Buffer.concat(chunks).toString();
      const state = JSON.parse(input);
      console.log(formatBudgetState(state, options.format as 'text' | 'json'));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('set')
  .description('Output a budget definition from parameters (pipe to controller)')
  .requiredOption('--scope <scope>', 'Scope in format "type:key"')
  .requiredOption('--limit <limit>', 'Budget limit in USD')
  .option('--soft-cap <ratio>', 'Soft cap ratio (0-1)', '0.8')
  .option('--hard-cap <ratio>', 'Hard cap ratio (0-1)', '1.0')
  .option(
    '--downgrade <rules>',
    'Downgrade rules as JSON array (e.g. \'[{"from":["a"],"to":"b"}]\')',
  )
  .option('--disable-tools <tools>', 'Comma-separated tools to disable', '')
  .action((options: Record<string, string>) => {
    try {
      const parsed = parseScope(options.scope);
      const downgrade = options.downgrade ? JSON.parse(options.downgrade) : [];
      const disableTools = options.disableTools
        ? options.disableTools.split(',').filter(Boolean)
        : [];

      const definition = {
        scopeType: parsed.scopeType,
        scopeKey: parsed.scopeKey,
        limit: Number(options.limit),
        policy: {
          softCap: Number(options.softCap),
          hardCap: Number(options.hardCap),
          autoDowngrade: downgrade,
          disableTools,
        },
      };

      console.log(JSON.stringify(definition, null, 2));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Output a reset command for a scope (pipe to controller)')
  .argument('<scope>', 'Scope in format "type:key" (e.g. user:user-123)')
  .action((scope: string) => {
    try {
      const parsed = parseScope(scope);
      console.log(JSON.stringify({ action: 'reset', ...parsed }, null, 2));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('validate-config')
  .description('Validate a budget configuration from stdin')
  .action(async () => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer);
      }
      const input = Buffer.concat(chunks).toString();
      const config = JSON.parse(input);

      const errors: string[] = [];

      if (
        config.scopeType !== undefined &&
        !Object.values(BudgetScope).includes(config.scopeType)
      ) {
        errors.push('scopeType must be one of: task, user, session, org');
      }
      if (config.scopeKey !== undefined && config.scopeKey.length === 0) {
        errors.push('scopeKey must not be empty');
      }

      if (config.limit !== undefined && (typeof config.limit !== 'number' || config.limit <= 0)) {
        errors.push('limit must be a positive number');
      }
      if (config.policy) {
        if (
          config.policy.softCap !== undefined &&
          (typeof config.policy.softCap !== 'number' ||
            config.policy.softCap < 0 ||
            config.policy.softCap > 1)
        ) {
          errors.push('softCap must be a number between 0 and 1');
        }
        if (
          config.policy.hardCap !== undefined &&
          (typeof config.policy.hardCap !== 'number' ||
            config.policy.hardCap < 0 ||
            config.policy.hardCap > 1)
        ) {
          errors.push('hardCap must be a number between 0 and 1');
        }
        if (
          config.policy.softCap !== undefined &&
          config.policy.hardCap !== undefined &&
          config.policy.softCap > config.policy.hardCap
        ) {
          errors.push('softCap must not exceed hardCap');
        }
      }

      if (errors.length > 0) {
        console.error('Validation errors:');
        for (const err of errors) {
          console.error(`  - ${err}`);
        }
        process.exit(1);
      }

      console.log('Configuration is valid.');
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('simulate')
  .description('Simulate whether a request fits within budget')
  .requiredOption('--scope <scope>', 'Scope in format "type:key"')
  .requiredOption('--model <model>', 'Model ID to simulate')
  .option('--input-tokens <tokens>', 'Estimated input tokens', '1000')
  .option('--output-tokens <tokens>', 'Estimated output tokens', '500')
  .option('-c, --config <path>', 'Path to JSON budget configuration file')
  .action((options: Record<string, string>) => {
    try {
      const parsed = parseScope(options.scope);
      if (!options.config) {
        console.log(
          JSON.stringify(
            {
              scope: { scopeType: parsed.scopeType, scopeKey: parsed.scopeKey },
              model: options.model,
              estimatedInputTokens: Number(options.inputTokens),
              estimatedOutputTokens: Number(options.outputTokens),
              note: 'Use --config <path> with a JSON budget config for live simulation',
            },
            null,
            2,
          ),
        );
        return;
      }

      const config = JSON.parse(readFileSync(options.config, 'utf-8'));
      const definitions = Array.isArray(config) ? config : [config];
      const spendTracker = new SpendStore({ maxEntries: 500_000 });
      const pricing = new PricingEngine();
      const controller = new BudgetController({ spendTracker, pricing });

      for (const def of definitions) {
        controller.defineBudget(def);
      }

      const inputTokens = Number(options.inputTokens);
      const outputTokens = Number(options.outputTokens);
      const estimatedCost = pricing.computeCost(inputTokens, outputTokens, options.model);

      const result = controller.check({
        scopeType: parsed.scopeType,
        scopeKey: parsed.scopeKey,
        estimatedCost,
        modelId: options.model,
        tools: [],
      });

      console.log(
        JSON.stringify(
          {
            scope: { scopeType: parsed.scopeType, scopeKey: parsed.scopeKey },
            model: options.model,
            inputTokens,
            outputTokens,
            estimatedCost,
            result,
          },
          null,
          2,
        ),
      );
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program.parse();
