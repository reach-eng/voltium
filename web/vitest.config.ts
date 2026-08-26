import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // tsconfig has `jsx: "preserve"` (Next.js convention), so Vite/oxc needs
  // explicit JSX handling to compile .test.tsx files for vitest.
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    setupFiles: [path.resolve(__dirname, './tests/setup-env.ts')],
    globalSetup: ['./tests/global-setup.ts'],
    css: false,
    testTimeout: 60000,
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      // Unit tests cover server-side business logic (lib/, server/, lib/).
      // src/app/ (Next.js pages and route handlers) is covered by
      // integration tests that run against a live dev server (see CI
      // `test:integration` job), not by unit tests. Including it here
      // would deflate the coverage numbers to ~17% because route
      // handlers are never imported by unit tests.
      include: [
        'src/lib/**/*.{ts,tsx}',
        'src/server/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/contracts/**',
        'src/**/*.d.ts',
        'src/**/__mocks__/**',
        'src/**/types.ts',
        'src/**/*.config.ts',
        'src/generated/**',
      ],
      // Unit test coverage thresholds. The full coverage target of 85%
      // is measured across unit + integration + e2e tests (see
      // docs/TESTING_STRATEGY.md). Unit tests alone cover ~25-30% of
      // src/lib/ and src/server/ because many code paths require a
      // running Next.js dev server (covered by integration tests).
      // Progressive threshold schedule:
      // - Phase A (Current): Unit: 25% lines, Combined: 85% lines
      // - Phase B (Q3 2026): Unit: 50% lines, Combined: 88% lines
      // - Phase C (Q4 2026): Unit: 75% lines, Combined: 90% lines
      thresholds: {
        lines: 25,
        functions: 20,
        branches: 20,
        statements: 25,
        perFile: false,
      },
      skipFull: false,
    },
    deps: {
      optimizer: {
        web: {
          enabled: true,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
