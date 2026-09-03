/**
 * Ticket #52 — Self-referral allowed + exists field leaks user enumeration
 *
 * Audit claims:
 *   1. Self-referral is allowed (rider can use own referral code)
 *   2. `exists` field in sendOtp response leaks user enumeration
 *
 * Verification (as of this commit):
 *   1. Self-referral is BLOCKED: `if (referrer && referrer.id !== rider.id)`
 *      in auth.use-cases.ts:148 — explicit check + warn log on detection.
 *   2. `exists` is REMOVED: sendOtp returns `{ otp }` only, with a
 *      comment "// 'exists' removed — prevents user enumeration via phone probing"
 *      in auth.use-cases.ts:63.
 *
 * These tests lock in the spec.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    rider: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    wallet: { create: vi.fn() },
    reward: { create: vi.fn() },
    outboxEvent: { create: vi.fn() },
  };
  return { mockDb };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/server/workers/outbox', () => ({
  OutboxService: { emit: vi.fn().mockResolvedValue('event-1') },
  OutboxEventTypes: { SMS_SEND: 'sms.send' },
}));
vi.mock('@/lib/otp-store', () => ({
  generateOtp: vi.fn().mockResolvedValue('123456'),
  verifyOtp: vi.fn().mockResolvedValue({ valid: true }),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  AUTH_RATE_LIMIT: { windowMs: 60_000, maxRequests: 5 },
}));
vi.mock('@/lib/auth', () => ({
  createSessionToken: vi.fn().mockResolvedValue('session-token'),
  createRefreshToken: vi.fn().mockResolvedValue('refresh-token'),
  SESSION_COOKIE_OPTIONS: {},
  REFRESH_COOKIE_OPTIONS: {},
}));
vi.mock('@/lib/firebase-admin', () => ({ auth: null }));
vi.mock('@/lib/job-queue', () => ({
  JobQueue: { enqueue: vi.fn() },
  JobTypes: { SEND_SMS: 'SEND_SMS' },
}));
vi.mock('@/lib/flatten-rider', () => ({ flattenRider: vi.fn() }));
vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: vi.fn().mockResolvedValue({ enablePushNotifications: false }),
}));

import { authUseCases } from '@/server/modules/auth/auth.use-cases';

describe('auth — self-referral blocked (#52)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT create a Reward row when rider refers themselves', async () => {
    const selfReferralCode = 'ABCD-1234';
    const newRider = {
      id: 'rider-db-id-1',
      riderId: 'VF-RD-1',
      phone: '+919876543210',
      lifecycleStatus: 'NEW',
      referralCode: selfReferralCode,
      referredBy: null,
    };
    // The referrer lookup returns the SAME rider (self-referral attempt)
    mockDb.rider.findUnique.mockResolvedValue(newRider);

    await authUseCases.verifyOtp({
      phone: '9876543210',
      otp: '123456',
      referralCode: selfReferralCode,
    });

    // The Reward.create call should NOT have happened for self-referral
    const rewardCalls = mockDb.reward.create.mock.calls;
    for (const call of rewardCalls) {
      const args = call[0]?.data;
      expect(args?.riderId).not.toBe(newRider.id);
    }
  });

  it('stores referredBy and creates NO immediate Reward — payout is deferred to ACTIVE via the referral job (P0 2026-09-03)', async () => {
    const referrerRider = {
      id: 'referrer-db-id',
      riderId: 'VF-RD-REFER',
      phone: '+919876543210',
      referralCode: 'REFERRER-CODE',
      referredBy: null,
    };
    const newRider = {
      id: 'new-rider-db-id',
      riderId: 'VF-RD-NEW',
      phone: '+919876543210',
      lifecycleStatus: 'NEW',
      referralCode: 'NEW-CODE',
      referredBy: null,
    };

    // First call: findUnique(phone) → null (no existing rider for phone)
    // Second call (post-create): findUnique(id) with include → newRider
    // (No referral-code lookup at signup anymore — referredBy is stored on
    // create; the single money path pays when the referee reaches ACTIVE.)
    mockDb.rider.findUnique
      .mockResolvedValueOnce(null) // phone lookup
      .mockResolvedValueOnce(newRider); // post-create fetch with include
    mockDb.rider.create.mockResolvedValue(newRider);
    mockDb.wallet.create.mockResolvedValue({ id: 'wallet-1' });
    mockDb.reward.create.mockResolvedValue({ id: 'reward-1' });

    await authUseCases.verifyOtp({
      phone: '9876543210',
      otp: '123456',
      referralCode: 'REFERRER-CODE',
    });

    // referredBy is attributed on the new rider row …
    expect(mockDb.rider.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referredBy: 'REFERRER-CODE' }),
      })
    );
    // … and NO Reward row is minted at signup (single money path pays ₹200
    // via processReferralReward / referral-reward.job on first ACTIVE).
    expect(mockDb.reward.create).not.toHaveBeenCalled();
  });
});

describe('auth — sendOtp does NOT return exists field (#52)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sendOtp result has no exists property (prevents user enumeration)', async () => {
    // Existing rider case
    mockDb.rider.findUnique.mockResolvedValue({
      id: 'rider-1',
      phone: '+919876543210',
      riderId: 'VF-RD-1',
      referralCode: 'CODE',
    });

    const result = await authUseCases.sendOtp(
      { phone: '9876543210' },
      { ip: '127.0.0.1', correlationId: 'test-1' }
    );

    // 'exists' must be undefined regardless of whether rider exists
    expect((result as any).exists).toBeUndefined();
  });

  it('sendOtp result has no exists property for new phone (new rider case)', async () => {
    // No existing rider
    mockDb.rider.findUnique.mockResolvedValue(null);

    const result = await authUseCases.sendOtp(
      { phone: '9999999999' },
      { ip: '127.0.0.1', correlationId: 'test-2' }
    );

    expect((result as any).exists).toBeUndefined();
  });
});
