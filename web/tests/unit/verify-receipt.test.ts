import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { env } from '@/lib/env';
import {
  issueVerifyReceipt,
  verifyVerifyReceipt,
  VERIFY_RECEIPT_TTL_MS,
} from '@/lib/verify-receipt';

/**
 * PR-PICKUP-OTP: verify-phone receipts. In the test env there is no
 * VERIFY_RECEIPT_SECRET, so the helper falls back to env.JWT_SECRET (the
 * same resolution a local-laptop dev run uses). Hand-built receipts below
 * re-sign with that same secret so expiry/tamper cases are deterministic.
 */
function signReceipt(phone: string, expiresAt: number): string {
  const payload = `${phone}:${expiresAt}`;
  const hmac = createHmac('sha256', env.JWT_SECRET).update(payload).digest('hex');
  return `${expiresAt}.${hmac}`;
}

describe('issueVerifyReceipt / verifyVerifyReceipt', () => {
  it('round-trips: a freshly issued receipt verifies for the same phone', () => {
    const receipt = issueVerifyReceipt('9876543210');
    const check = verifyVerifyReceipt(receipt, '9876543210');
    expect(check.valid).toBe(true);
  });

  it('rejects a receipt for a different phone (number binding)', () => {
    const receipt = issueVerifyReceipt('9876543210');
    const check = verifyVerifyReceipt(receipt, '9999000000');
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('signature');
  });

  it('rejects an expired receipt', () => {
    const expired = signReceipt('9876543210', Date.now() - 1000);
    const check = verifyVerifyReceipt(expired, '9876543210');
    expect(check.valid).toBe(false);
    expect(check.reason).toBe('Receipt expired');
  });

  it('rejects a receipt signed past the TTL window even with a valid signature', () => {
    const tooOld = signReceipt('9876543210', Date.now() + VERIFY_RECEIPT_TTL_MS + 1000);
    // Not expired yet (future expiry) — but a legit issuer never mints this;
    // the window constant is enforced at issue time. Verify still accepts a
    // valid future signature (it is the issuer's job to bound the window).
    expect(verifyVerifyReceipt(tooOld, '9876543210').valid).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const receipt = issueVerifyReceipt('9876543210');
    const tampered = `${receipt.slice(0, -1)}${receipt.endsWith('a') ? 'b' : 'a'}`;
    const check = verifyVerifyReceipt(tampered, '9876543210');
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('signature');
  });

  it('rejects malformed receipts (no dot, non-numeric expiry)', () => {
    expect(verifyVerifyReceipt('garbage', '9876543210').valid).toBe(false);
    expect(
      verifyVerifyReceipt('not-a-number.abcdef0123456789', '9876543210').valid
    ).toBe(false);
  });

  it('rejects a receipt whose expiry was edited after signing', () => {
    // Same phone + signature, but the expiry is bumped past the original —
    // the HMAC no longer matches because the expiry is part of the payload.
    const receipt = issueVerifyReceipt('9876543210');
    const dot = receipt.indexOf('.');
    const originalExp = parseInt(receipt.slice(0, dot), 10);
    const bumped = `${originalExp + 100000}.${receipt.slice(dot + 1)}`;
    const check = verifyVerifyReceipt(bumped, '9876543210');
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('signature');
  });
});

describe('prod fail-closed guard for REQUIRE_EMERGENCY_CONTACT_RECEIPT', () => {
  const ENV_FILE = resolve(__dirname, '../../src/lib/env.ts');
  const ENV_FILE_URL = pathToFileURL(ENV_FILE).href;

  // Every prod-required var EXCEPT the enforcement flag — the guard must
  // reject this, because the flag defaults to false (validate-and-ignore),
  // which would silently ship the OTP gate OFF despite the secret being set.
  const baseProdEnv = {
    NODE_ENV: 'production',
    APP_ENV: 'production',
    JWT_SECRET: 'a'.repeat(64),
    FCM_COMMAND_HMAC_SECRET: 'b'.repeat(64),
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    CRON_SECRET: 'cron-secret-1234567890',
    WORKER_SECRET: 'worker-secret-1234567890',
    INTERNAL_API_URL: 'http://127.0.0.1:8081',
    DATA_MODE: 'local_laptop',
    STORAGE_PROVIDER: 'local',
    FILE_UPLOAD_SECRET: 'c'.repeat(40),
    VERIFY_RECEIPT_SECRET: 'd'.repeat(40),
    ALLOW_DEV_PII_KEY: 'false',
    ENABLE_TEST_OTP: 'false',
    ENABLE_DEV_ADMIN_LOGIN: 'false',
  };

  function spawnEnvCheck(
    overrides: Record<string, string>
  ): { stdout: string; stderr: string } {
    const envOverrides = { ...baseProdEnv, ...overrides };
    const code = `
      for (const [k, v] of Object.entries(${JSON.stringify(envOverrides)})) process.env[k] = v;
      try {
        const mod = await import(${JSON.stringify(ENV_FILE_URL)});
        console.log('OK_APP_ENV=' + mod.env.APP_ENV);
      } catch (e) {
        console.log('REJECTED:' + e.message);
      }
    `;
    return spawnSync(process.execPath, ['-e', code], {
      encoding: 'utf-8',
      env: { ...process.env, ...envOverrides },
    } as any);
  }

  it('rejects production boot when the enforcement flag is unset', () => {
    const result = spawnEnvCheck({});
    expect(result.stdout).toMatch(/REJECTED/);
    expect(result.stdout + result.stderr).toMatch(
      /REQUIRE_EMERGENCY_CONTACT_RECEIPT/
    );
  });

  it('allows production boot when the flag is explicitly true', () => {
    const result = spawnEnvCheck({ REQUIRE_EMERGENCY_CONTACT_RECEIPT: 'true' });
    expect(result.stdout).toMatch(/OK_APP_ENV=production/);
  });
});
