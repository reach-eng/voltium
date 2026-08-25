/**
 * AUDIT FIX (N-1) — Universal '111111' master OTP gate contradiction.
 *
 * The previous gate accepted `ENABLE_TEST_OTP=true` ALONE as sufficient to
 * hand out the universal dev OTP `'111111'` for any phone number:
 *
 *   (APP_ENV==='development' || NODE_ENV==='development' || ENABLE_TEST_OTP==='true')
 *     && ENABLE_TEST_OTP!=='false'
 *
 * That is total rider account takeover in staging — or in prod with APP_ENV
 * unset (env.ts defaults it to 'development'). The fixed gate requires
 * BOTH APP_ENV and NODE_ENV to be exactly 'development'.
 *
 * These tests lock the corrected behavior in: staging / prod / unset-env
 * must NEVER mint '111111', even with ENABLE_TEST_OTP=true.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

describe('OTP store — N-1 master OTP env gate', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    vi.resetAllMocks();
    // Staging/prod force the Postgres store path — make the mocked db
    // behave like "no existing record / successful writes".
    (db.otpCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.otpCode.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.otpCode.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.otpCode.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
    // Force in-memory store so no DB round-trips are needed.
    process.env.OTP_STORE_PROVIDER = 'memory';
    await clearOtpStore();
    saved.NODE_ENV = process.env.NODE_ENV;
    saved.APP_ENV = process.env.APP_ENV;
    saved.ENABLE_TEST_OTP = process.env.ENABLE_TEST_OTP;
  });

  afterEach(() => {
    process.env.NODE_ENV = saved.NODE_ENV;
    process.env.APP_ENV = saved.APP_ENV;
    if (saved.ENABLE_TEST_OTP === undefined) {
      delete process.env.ENABLE_TEST_OTP;
    } else {
      process.env.ENABLE_TEST_OTP = saved.ENABLE_TEST_OTP;
    }
  });

  it('mints 111111 ONLY when APP_ENV=development AND NODE_ENV=development', async () => {
    process.env.APP_ENV = 'development';
    process.env.NODE_ENV = 'development';
    const code = await generateOtp('8000000001');
    expect(code).toBe('111111');
  });

  it('rejects the shortcut in staging even with ENABLE_TEST_OTP=true', async () => {
    process.env.APP_ENV = 'staging';
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_TEST_OTP = 'true';
    const code = await generateOtp('8000000002');
    expect(code).not.toBe('111111');
    expect(code).toMatch(/^\d{6}$/);
  });

  it('rejects the shortcut in production even with ENABLE_TEST_OTP=true', async () => {
    process.env.APP_ENV = 'production';
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_TEST_OTP = 'true';
    const code = await generateOtp('8000000003');
    expect(code).not.toBe('111111');
    expect(code).toMatch(/^\d{6}$/);
  });

  it('rejects the shortcut when APP_ENV is unset (prod misconfig default)', async () => {
    delete process.env.APP_ENV;
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_TEST_OTP = 'true';
    const code = await generateOtp('8000000004');
    expect(code).not.toBe('111111');
    expect(code).toMatch(/^\d{6}$/);
  });

  it('rejects the shortcut when only NODE_ENV is development but APP_ENV is not', async () => {
    process.env.APP_ENV = 'production';
    process.env.NODE_ENV = 'development';
    const code = await generateOtp('8000000005');
    expect(code).not.toBe('111111');
  });

  it('honours ENABLE_TEST_OTP=false even in full dev', async () => {
    process.env.APP_ENV = 'development';
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_TEST_OTP = 'false';
    const code = await generateOtp('8000000006');
    expect(code).not.toBe('111111');
    expect(code).toMatch(/^\d{6}$/);
  });

  describe('verifyOtp master OTP gate', () => {
    it('allows 111111 in development when APP_ENV=development and NODE_ENV=development', async () => {
      process.env.APP_ENV = 'development';
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_TEST_OTP = 'true';
      await generateOtp('8000000007');
      const result = await verifyOtp('8000000007', '111111');
      expect(result.valid).toBe(true);
    });

    it('rejects 111111 in staging even with ENABLE_TEST_OTP=true', async () => {
      process.env.APP_ENV = 'staging';
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_TEST_OTP = 'true';
      const realOtp = await generateOtp('8000000008');
      expect(realOtp).not.toBe('111111');
      const result = await verifyOtp('8000000008', '111111');
      expect(result.valid).toBe(false);
    });

    it('rejects 111111 in production even with ENABLE_TEST_OTP=true', async () => {
      process.env.APP_ENV = 'production';
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_TEST_OTP = 'true';
      const realOtp = await generateOtp('8000000009');
      expect(realOtp).not.toBe('111111');
      const result = await verifyOtp('8000000009', '111111');
      expect(result.valid).toBe(false);
    });
  });
});
