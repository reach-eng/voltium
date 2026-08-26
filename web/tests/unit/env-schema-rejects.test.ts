/**
 * Ticket #50 — ALLOW_DEV_PII_KEY must be rejected in production env schema
 *
 * Audit claim: env schema accepts ALLOW_DEV_PII_KEY=true in production
 * environments. The runtime check at env.ts:222 catches it but with a
 * less visible error. The fix adds a parse-time refine.
 *
 * This test spawns a node child that imports the env schema and asserts
 * that ALLOW_DEV_PII_KEY=true in production is rejected at parse time
 * (not just at runtime).
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const ENV_FILE = resolve(__dirname, '../../src/lib/env.ts');
const ENV_FILE_URL = pathToFileURL(ENV_FILE).href;

function spawnEnvCheck(envOverrides: Record<string, string>): { status: number | null; stdout: string; stderr: string } {
  const code = `
    const env = ${JSON.stringify(envOverrides)};
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
    try {
      // Dynamic import to pick up the overrides
      const mod = await import(${JSON.stringify(ENV_FILE_URL)});
      console.log('OK_APP_ENV=' + mod.env.APP_ENV);
    } catch (e) {
      console.log('REJECTED:' + e.message);
    }
  `;
  return spawnSync(process.execPath, ['-e', code], {
    encoding: 'utf-8',
    env: { ...process.env, ...envOverrides },
  });
}

/**
 * Schema-validation messages go to console.error, not the throw. We
 * check BOTH stdout (for the catch) and stderr (for the schema-format
 * error). The assertion is "if it failed, was it because of
 * ALLOW_DEV_PII_KEY?".
 */
function hasAllowDevPiiKeyError(result: { stdout: string; stderr: string }): boolean {
  return /ALLOW_DEV_PII_KEY/.test(result.stdout) || /ALLOW_DEV_PII_KEY/.test(result.stderr);
}

describe('env schema rejects ALLOW_DEV_PII_KEY in production (#50)', () => {
  it('rejects ALLOW_DEV_PII_KEY=true when APP_ENV=production', () => {
    const result = spawnEnvCheck({
      APP_ENV: 'production',
      ALLOW_DEV_PII_KEY: 'true',
      JWT_SECRET: 'a'.repeat(64),
      FCM_COMMAND_HMAC_SECRET: 'b'.repeat(64),
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    });
    expect(result.stdout).toMatch(/REJECTED/);
    expect(hasAllowDevPiiKeyError(result)).toBe(true);
  });

  it('rejects ALLOW_DEV_PII_KEY=true when APP_ENV=staging', () => {
    const result = spawnEnvCheck({
      APP_ENV: 'staging',
      ALLOW_DEV_PII_KEY: 'true',
      JWT_SECRET: 'a'.repeat(64),
      FCM_COMMAND_HMAC_SECRET: 'b'.repeat(64),
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    });
    expect(result.stdout).toMatch(/REJECTED/);
    expect(hasAllowDevPiiKeyError(result)).toBe(true);
  });

  it('rejects ALLOW_DEV_PII_KEY=true when NODE_ENV=production (legacy check)', () => {
    const result = spawnEnvCheck({
      NODE_ENV: 'production',
      ALLOW_DEV_PII_KEY: 'true',
      JWT_SECRET: 'a'.repeat(64),
      FCM_COMMAND_HMAC_SECRET: 'b'.repeat(64),
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    });
    expect(result.stdout).toMatch(/REJECTED/);
    expect(hasAllowDevPiiKeyError(result)).toBe(true);
  });

  it('accepts ALLOW_DEV_PII_KEY=true in development (no schema rejection)', () => {
    const result = spawnEnvCheck({
      APP_ENV: 'development',
      ALLOW_DEV_PII_KEY: 'true',
      JWT_SECRET: 'a'.repeat(64),
      FCM_COMMAND_HMAC_SECRET: 'b'.repeat(64),
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    });
    // In development, schema validation should pass (no production guards)
    expect(result.stdout).toMatch(/OK_APP_ENV=development/);
  });

  it('accepts ALLOW_DEV_PII_KEY=false in production (defense is off, not the key)', () => {
    const result = spawnEnvCheck({
      APP_ENV: 'production',
      ALLOW_DEV_PII_KEY: 'false',
      JWT_SECRET: 'a'.repeat(64),
      FCM_COMMAND_HMAC_SECRET: 'b'.repeat(64),
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    });
    // Should NOT be rejected for ALLOW_DEV_PII_KEY reasons
    expect(hasAllowDevPiiKeyError(result)).toBe(false);
  });
});
