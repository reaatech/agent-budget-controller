import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: {
    resolve: true,
  },
  clean: true,
  tsconfig: './tsconfig.json',
});
