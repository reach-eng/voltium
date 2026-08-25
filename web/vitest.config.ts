import net from 'node:net';
import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * AUDIT FIX (testing-strategy W4): restore the local dev loop.
 *
 * ~80 live-server suites (tests/api, tests/integration, tests/security,
 * tests/api-routes.test.ts) hard-fail when the Next.js dev server isn't
 * running on :8081. In CI the server is always started first, so they run.
 * Locally they made every full-suite run permanently red, which trained
 * developers to ignore failures.
 *
 * Resolution: at config load we probe :8081 with a 300ms budget. If the
 * server is absent (and we're not in CI), those suites are EXCLUDED from
 * the run with a printed notice instead of failing. Set
 * VOLT_FORCE_LIVE_SERVER=1 to override the probe and include them anyway
 * (they will fail fast if the server truly is down).
 */
async function isLiveServerUp(): Promise<boolean> {
  if (process.env.VOLT_FORCE_LIVE_SERVER === '1') return true;
  if (process.env.CI) return true; // CI always starts the server

  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    const done = (up: boolean) => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(300);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(8081, '127.0.0.1');
  });
}

export default defineConfig(async () => {
  const liveServerUp = await isLiveServerUp();
  // Patterns excluded when the dev server is not running locally.
  const liveServerOnly = [
    'tests/api/**/*.test.{ts,tsx}',
    'tests/integration/**/*.test.{ts,tsx}',
    'tests/security/**/*.test.{ts,tsx}',
    'tests/api-routes.test.ts',
  ];

  if (!liveServerUp) {
    console.log(
      '\n[vitest] Live server not detected on :8081 — excluding ' +
        'live-server suites (tests/api, tests/integration, tests/security). ' +
        'Start the dev server or set VOLT_FORCE_LIVE_SERVER=1 to include them.\n',
    );
  }

  return {
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
      exclude: liveServerUp ? [] : liveServerOnly,
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
  } as any;
});
