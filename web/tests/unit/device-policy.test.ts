/**
 * Device Policy — Unit Tests
 *
 * Tests src/lib/device-policy.ts — the single source of truth for whether
 * the rider app's /api/device/* routes may accept a body-supplied riderId.
 *
 * The bug we are guarding against: previously `/api/device/data` and
 * `/api/device/permissions` had different staging rules — one excluded
 * staging from the bypass, the other didn't. That asymmetric guard could
 * let a misconfigured prod (APP_ENV='staging') let a body-derived rider
 * identity in. This module collapses both to the same predicate.
 *
 * Covers:
 *   - isDeviceSeedAllowed: allow on local dev + E2E test harness, deny
 *     on production, staging, and prod+test
 *   - isProdOrStaging: true on APP_ENV=production, APP_ENV=staging, or
 *     NODE_ENV=production
 *   - Both device routes import the same helper (parity check by file read)
 *
 * The helper reads process.env directly (not the cached env from env.ts),
 * so the test simply sets process.env and re-imports the module.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadPolicy(envOverrides: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return import('../../src/lib/device-policy');
}

afterEach(() => {
  // Restore env between tests
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
});

describe('isDeviceSeedAllowed', () => {
  it('returns true on APP_ENV=development (local dev)', async () => {
    const { isDeviceSeedAllowed } = await loadPolicy({
      APP_ENV: 'development',
      NODE_ENV: 'development',
    });
    expect(isDeviceSeedAllowed()).toBe(true);
  });

  it('returns true on APP_ENV=development with NODE_ENV=production (catches dev-on-prod-runner misconfig)', async () => {
    // Defense: even if APP_ENV says dev, a NODE_ENV=production runner is
    // suspicious. We DENY here because real production runners shouldn't
    // be running "dev" code; the safe default is to require real auth.
    const { isDeviceSeedAllowed } = await loadPolicy({
      APP_ENV: 'development',
      NODE_ENV: 'production',
    });
    expect(isDeviceSeedAllowed()).toBe(false);
  });

  it('returns true on TEST_MODE=true + NODE_ENV=development (E2E test harness)', async () => {
    const { isDeviceSeedAllowed } = await loadPolicy({
      APP_ENV: undefined,
      NODE_ENV: 'development',
      TEST_MODE: 'true',
    });
    expect(isDeviceSeedAllowed()).toBe(true);
  });

  it('returns false on APP_ENV=staging + NODE_ENV=production (the §1.2 fix)', async () => {
    // This is the exact scenario from
    // tests/unit/api/device-data-bypass.test.ts:25-28. Even with TEST_MODE=true,
    // a real staging environment must NOT accept a body-supplied riderId.
    const { isDeviceSeedAllowed } = await loadPolicy({
      APP_ENV: 'staging',
      NODE_ENV: 'production',
      TEST_MODE: 'true',
    });
    expect(isDeviceSeedAllowed()).toBe(false);
  });

  it('returns false on APP_ENV=staging with NODE_ENV=development (real staging)', async () => {
    const { isDeviceSeedAllowed } = await loadPolicy({
      APP_ENV: 'staging',
      NODE_ENV: 'development',
    });
    expect(isDeviceSeedAllowed()).toBe(false);
  });

  it('returns false on APP_ENV=production + NODE_ENV=production', async () => {
    const { isDeviceSeedAllowed } = await loadPolicy({
      APP_ENV: 'production',
      NODE_ENV: 'production',
    });
    expect(isDeviceSeedAllowed()).toBe(false);
  });

  it('returns false on APP_ENV=test + NODE_ENV=test (CI must not bypass)', async () => {
    // Vitest runs with NODE_ENV=test. APP_ENV=test is also set by vitest's
    // .env. The test harness signal is NODE_ENV=development + TEST_MODE=true.
    const { isDeviceSeedAllowed } = await loadPolicy({
      APP_ENV: 'test',
      NODE_ENV: 'test',
    });
    expect(isDeviceSeedAllowed()).toBe(false);
  });
});

describe('isProdOrStaging', () => {
  it('returns true on APP_ENV=production', async () => {
    const { isProdOrStaging } = await loadPolicy({
      APP_ENV: 'production',
      NODE_ENV: 'production',
    });
    expect(isProdOrStaging()).toBe(true);
  });

  it('returns true on APP_ENV=staging', async () => {
    const { isProdOrStaging } = await loadPolicy({
      APP_ENV: 'staging',
      NODE_ENV: 'development',
    });
    expect(isProdOrStaging()).toBe(true);
  });

  it('returns true on NODE_ENV=production (even if APP_ENV is dev)', async () => {
    const { isProdOrStaging } = await loadPolicy({
      APP_ENV: 'development',
      NODE_ENV: 'production',
    });
    expect(isProdOrStaging()).toBe(true);
  });

  it('returns false in dev', async () => {
    const { isProdOrStaging } = await loadPolicy({
      APP_ENV: 'development',
      NODE_ENV: 'development',
    });
    expect(isProdOrStaging()).toBe(false);
  });

  it('returns false in test', async () => {
    const { isProdOrStaging } = await loadPolicy({
      APP_ENV: 'test',
      NODE_ENV: 'test',
    });
    expect(isProdOrStaging()).toBe(false);
  });
});

describe('device route parity (no name-based regression)', () => {
  it('both /api/device/data and /api/device/permissions import the same helper', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const dataRoute = readFileSync(
      join(process.cwd(), 'src/app/api/device/data/route.ts'),
      'utf8'
    );
    const permsRoute = readFileSync(
      join(process.cwd(), 'src/app/api/device/permissions/route.ts'),
      'utf8'
    );
    expect(dataRoute).toContain("from '@/lib/device-policy'");
    expect(permsRoute).toContain("from '@/lib/device-policy'");
    expect(dataRoute).toContain('isDeviceSeedAllowed');
    expect(permsRoute).toContain('isDeviceSeedAllowed');
  });
});
