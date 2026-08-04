/**
 * PR-111 (SEC PR-3) — dev OTP `'111111'` is the LAST gate, after all state checks.
 *
 * The audit flagged that the dev backdoor in `web/src/lib/otp-store.ts` could
 * accept `'111111'` for an entry that was already verified, expired, or had
 * exceeded the attempt cap. This was a SOC2/GDPR gap: the dev convenience
 * code bypassed OTP lifecycle guards.
 *
 * The fix moves the `if (isDev && code === '111111')` check to AFTER:
 *   - `entry === null`           (no entry → "No OTP found")
 *   - `entry.verified === true`   (already used → "OTP already used")
 *   - `Date.now() > expiresAt`   (expired → "OTP expired")
 *   - `attempts > MAX_ATTEMPTS`  (rate limited → "Too many failed attempts")
 *
 * This test locks in that ordering for the in-memory branch (the same fix
 * is applied to the PostgreSQL branch in src/lib/otp-store.ts).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    otpCode: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { db } from '@/lib/db';
import { generateOtp, verifyOtp, clearOtpStore } from '@/lib/otp-store';

const PHONE = '9999999999';

describe('PR-111: dev OTP `111111` check is the LAST gate', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppEnv = process.env.APP_ENV;

  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.NODE_ENV = 'development';
    process.env.APP_ENV = 'development';
    process.env.ENABLE_TEST_OTP = 'true';
    // Force in-memory store path
    process.env.OTP_STORE_PROVIDER = 'memory';
    await clearOtpStore();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.APP_ENV = originalAppEnv;
    process.env.ENABLE_TEST_OTP = '';
    process.env.OTP_STORE_PROVIDER = '';
  });

  it('rejects `111111` when no entry exists (memory branch)', async () => {
    // No generateOtp() call — no entry
    const result = await verifyOtp(PHONE, '111111');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/No OTP found/);
  });

  it('accepts `111111` after entry exists and is unverified (memory branch)', async () => {
    await generateOtp(PHONE);
    const result = await verifyOtp(PHONE, '111111');
    expect(result.valid).toBe(true);
  });

  it('rejects `111111` when expiry has passed (memory branch, Date.now shift)', async () => {
    // Pre-populate entry, then shift Date.now past the expiry.
    await generateOtp(PHONE);
    const realNow = Date.now;
    const future = realNow() + 10 * 60 * 1000 + 1;
    Date.now = () => future;
    try {
      const result = await verifyOtp(PHONE, '111111');
      expect(result.valid).toBe(false);
      // Must NOT have bypassed via the dev check — should report expiry.
      expect(result.error).toBeDefined();
    } finally {
      Date.now = realNow;
    }
  });
});

describe('PR-111: dev OTP `111111` check is the LAST gate (DB branch)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppEnv = process.env.APP_ENV;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NODE_ENV = 'development';
    process.env.APP_ENV = 'development';
    process.env.ENABLE_TEST_OTP = 'true';
    process.env.OTP_STORE_PROVIDER = 'postgres';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.APP_ENV = originalAppEnv;
    process.env.ENABLE_TEST_OTP = '';
    process.env.OTP_STORE_PROVIDER = '';
  });

  it('rejects `111111` when the DB entry is already verified', async () => {
    (db.otpCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      phone: PHONE,
      codeHash: 'h',
      salt: 's',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      verified: true,
      resendCount: 1,
      lastSentAt: new Date(),
    });
    const result = await verifyOtp(PHONE, '111111');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/already used/);
  });

  it('rejects `111111` when the DB entry is expired', async () => {
    (db.otpCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      phone: PHONE,
      codeHash: 'h',
      salt: 's',
      expiresAt: new Date(Date.now() - 1),
      attempts: 0,
      verified: false,
      resendCount: 1,
      lastSentAt: new Date(),
    });
    const result = await verifyOtp(PHONE, '111111');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/);
  });

  it('rejects `111111` when the DB entry has exceeded the attempt cap', async () => {
    (db.otpCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      phone: PHONE,
      codeHash: 'h',
      salt: 's',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 3, // MAX_ATTEMPTS = 3
      verified: false,
      resendCount: 1,
      lastSentAt: new Date(),
    });
    (db.otpCode.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await verifyOtp(PHONE, '111111');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Too many failed attempts/);
  });

  it('rejects `111111` when the DB entry does not exist', async () => {
    (db.otpCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await verifyOtp(PHONE, '111111');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/No OTP found/);
  });

  it('accepts `111111` when the DB entry is healthy (verified=false, not expired, attempts < cap)', async () => {
    (db.otpCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      phone: PHONE,
      codeHash: 'h',
      salt: 's',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      verified: false,
      resendCount: 1,
      lastSentAt: new Date(),
    });
    const result = await verifyOtp(PHONE, '111111');
    expect(result.valid).toBe(true);
  });
});
