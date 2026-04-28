import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/index.ts',
        'packages/cli/src/cli.ts',
        '**/node_modules/**',
        '**/dist/**',
      ],
    },
    include: ['packages/*/tests/**/*.test.ts', 'packages/*/tests/**/*.spec.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@agent-budget-controller/types': path.resolve(__dirname, 'packages/types/src/index.ts'),
      '@agent-budget-controller/pricing': path.resolve(__dirname, 'packages/pricing/src/index.ts'),
      '@agent-budget-controller/spend-tracker': path.resolve(
        __dirname,
        'packages/spend-tracker/src/index.ts',
      ),
      '@agent-budget-controller/budget-engine': path.resolve(
        __dirname,
        'packages/budget-engine/src/index.ts',
      ),
      '@agent-budget-controller/middleware': path.resolve(
        __dirname,
        'packages/middleware/src/index.ts',
      ),
      '@agent-budget-controller/otel-bridge': path.resolve(
        __dirname,
        'packages/otel-bridge/src/index.ts',
      ),
      '@agent-budget-controller/llm-router-plugin': path.resolve(
        __dirname,
        'packages/llm-router-plugin/src/index.ts',
      ),
      '@agent-budget-controller/cli': path.resolve(__dirname, 'packages/cli/src/index.ts'),
    },
  },
});
