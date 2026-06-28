import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/realistic/**/*.test.ts'],
    setupFiles: [path.resolve(__dirname, './tests/realistic/setup.ts')],
    css: false,
    testTimeout: 30000,
    fileParallelism: false,
    pool: 'forks',
    singleFork: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
