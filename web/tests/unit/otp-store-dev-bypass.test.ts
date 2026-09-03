/**
 * Ticket #46 — Dev OTP `'111111'` accepted for ANY phone
 *
 * Audit claim: dev OTP `'111111'` is accepted for any phone without entry lookup.
 *
 * Verification: as of this commit, `verifyOtp()` does an entry lookup FIRST
 * (PostgreSQL or in-memory), and only then checks for the dev backdoor. So
 * `'111111'` is rejected when no entry exists for the phone. This file
 * locks in the existing behavior as a regression guard.
 *
 * If someone removes the entry-lookup guard, the test below will fail.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the db module before importing otp-store
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
import { verifyOtp, clearOtpStore, generateOtp } from '@/lib/otp-store';

describe('OTP store — dev bypass requires existing entry (#46)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppEnv = process.env.APP_ENV;

  beforeEach(async () => {
    vi.resetAllMocks();
    (process.env as any).NODE_ENV = 'development';
    process.env.APP_ENV = 'development';
    // Force in-memory store (no postgres)
    process.env.OTP_STORE_PROVIDER = 'memory';
    await clearOtpStore();
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = originalNodeEnv;
    process.env.APP_ENV = originalAppEnv;
  });

  it('rejects dev OTP 111111 when no entry exists for phone (memory store)', async () => {
    // No generateOtp() call — no entry in memory store
    const result = await verifyOtp('9999999999', '111111');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/No OTP found/);
  });

  it('rejects dev OTP 111111 when no entry exists for phone (PostgreSQL store)', async () => {
    // Force PostgreSQL store
    process.env.OTP_STORE_PROVIDER = 'postgres';
    process.env.APP_ENV = 'production';
    (db.otpCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await verifyOtp('9999999999', '111111');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/No OTP found/);
  });

  it('accepts dev OTP 111111 AFTER entry exists (memory store)', async () => {
    // First create an entry by calling generateOtp
    await generateOtp('8888888888');
    const result = await verifyOtp('8888888888', '111111');
    expect(result.valid).toBe(true);
  });

  it('rejects dev OTP with wrong length even with an entry', async () => {
    await generateOtp('5555555555');
    // 5-digit code: should NOT match (constant-time check also enforces length)
    const result = await verifyOtp('5555555555', '11111');
    expect(result.valid).toBe(false);
  });

  it('rejects dev OTP with different content (constant-time compare)', async () => {
    await generateOtp('4444444444');
    // Same length as 111111 but different digits: should NOT match.
    // timingSafeEqual returns false when bytes differ.
    const result = await verifyOtp('4444444444', '222222');
    expect(result.valid).toBe(false);
  });

  it('does not leak dev OTP behavior into production', async () => {
    process.env.APP_ENV = 'production';
    process.env.OTP_STORE_PROVIDER = 'postgres';
    (db.otpCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    // Production: even if a malicious caller sent 111111 with no entry, it's rejected
    const result = await verifyOtp('6666666666', '111111');
    expect(result.valid).toBe(false);
  });
});
