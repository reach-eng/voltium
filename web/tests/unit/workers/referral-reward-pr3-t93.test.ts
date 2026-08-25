/**
 * T-93 (PR-3, 2026-08-23) — regression test for the referral-reward
 * integrity fixes. The previous code:
 *
 *   1. Did not block self-referrals (referrer.id === referredRiderId).
 *   2. Did not check that the referee actually used this referrer's
 *      code (their `referredBy` field could be a different code).
 *   3. Did not put an `idempotencyKey` on the `Transaction` and
 *      `Reward` rows, so a job replay created duplicate audit-grade
 *      rows even though the wallet was protected.
 *   4. Swallowed errors in the catch block (`result.errors++` only)
 *      and the OutboxEvent was acked, losing the reward permanently.
 *
 * See docs/AUDIT_WORKFLOWS_2026-08-23.md §2.2.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const findUniqueRiderMock = vi.fn();
const findUniqueSettingMock = vi.fn();
const transactionCreateMock = vi.fn();
const rewardCreateMock = vi.fn();
const creditMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    rider: { findUnique: (...args: unknown[]) => findUniqueRiderMock(...args) },
    systemSetting: { findUnique: (...args: unknown[]) => findUniqueSettingMock(...args) },
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        transaction: { create: (...args: unknown[]) => transactionCreateMock(...args) },
        reward: { create: (...args: unknown[]) => rewardCreateMock(...args) },
      }),
  },
}));

vi.mock('@/server/modules/wallet/wallet-ledger.service', () => ({
  walletLedgerService: {
    credit: (...args: unknown[]) => creditMock(...args),
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { referralRewardJob } from '@/server/workers/jobs/referral-reward.job';

describe('T-93 referral-reward integrity', () => {
  beforeEach(() => {
    findUniqueRiderMock.mockReset();
    findUniqueSettingMock.mockReset();
    transactionCreateMock.mockReset();
    rewardCreateMock.mockReset();
    creditMock.mockReset();
    findUniqueSettingMock.mockResolvedValue(null);
    transactionCreateMock.mockResolvedValue({ id: 'txn-1' });
    rewardCreateMock.mockResolvedValue({ id: 'reward-1' });
    creditMock.mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.useRealTimers());

  it('blocks self-referral (referrer.id === referredRiderId)', async () => {
    // T-93: a rider who set their own referralCode in the
    // payload (or whose ID matches the referrer by accident) MUST
    // NOT get the bonus.
    findUniqueRiderMock.mockResolvedValue({
      id: 'rider-A',
      referredBy: null,
      wallet: { id: 'wallet-A' },
    });
    const result = await referralRewardJob.process({
      id: 'job-1',
      payload: { referredRiderId: 'rider-A', referralCode: 'CODE-A' },
    } as unknown as Parameters<typeof referralRewardJob.process>[0]);
    expect(result.errors).toBe(1);
    expect(result.rewardsCredited).toBe(0);
    expect(transactionCreateMock).not.toHaveBeenCalled();
    expect(creditMock).not.toHaveBeenCalled();
  });

  it('blocks when the referee has a different referrer', async () => {
    // T-93: linkage check. The referee's `referredBy` field
    // records the code they ACTUALLY used. If the job's
    // `referralCode` doesn't match, the reward is blocked —
    // otherwise a rider who guessed a code would get the bonus.
    findUniqueRiderMock.mockResolvedValue({
      id: 'rider-A',
      referredBy: 'CODE-X-DIFFERENT',
      wallet: { id: 'wallet-A' },
    });
    const result = await referralRewardJob.process({
      id: 'job-2',
      payload: { referredRiderId: 'rider-B', referralCode: 'CODE-A' },
    } as unknown as Parameters<typeof referralRewardJob.process>[0]);
    expect(result.errors).toBe(1);
    expect(transactionCreateMock).not.toHaveBeenCalled();
  });

  it('accepts when the referee has no prior referrer (first-time attribution)', async () => {
    // T-93: the common case. Referee is new, referrer is
    // distinct, linkage check passes (referredBy is null).
    findUniqueRiderMock.mockResolvedValue({
      id: 'rider-A',
      referredBy: null,
      wallet: { id: 'wallet-A' },
    });
    const result = await referralRewardJob.process({
      id: 'job-3',
      payload: { referredRiderId: 'rider-B', referralCode: 'CODE-A' },
    } as unknown as Parameters<typeof referralRewardJob.process>[0]);
    expect(result.errors).toBe(0);
    expect(result.rewardsCredited).toBe(1);
    // T-93: the Transaction row carries the idempotencyKey.
    expect(transactionCreateMock).toHaveBeenCalledTimes(1);
    const txArgs = transactionCreateMock.mock.calls[0][0];
    expect(txArgs.data.idempotencyKey).toBe('referral:rider-A:rider-B');
  });

  it('accepts when the referee\'s referredBy matches the resolved referrer', async () => {
    // T-93: the second-time case. The referee already had a
    // referrer recorded (by the signup flow) and the recorded
    // referrer IS this referrer.
    findUniqueRiderMock.mockResolvedValue({
      id: 'rider-A',
      referredBy: 'CODE-A',
      wallet: { id: 'wallet-A' },
    });
    const result = await referralRewardJob.process({
      id: 'job-4',
      payload: { referredRiderId: 'rider-B', referralCode: 'CODE-A' },
    } as unknown as Parameters<typeof referralRewardJob.process>[0]);
    expect(result.errors).toBe(0);
    expect(result.rewardsCredited).toBe(1);
  });

  it('rethrows on DB failure so the OutboxEvent retries', async () => {
    // T-93: the previous catch silently acked the event; the
    // rethrow lets the job-queue backoff engage.
    findUniqueRiderMock.mockResolvedValue({
      id: 'rider-A',
      referredBy: null,
      wallet: { id: 'wallet-A' },
    });
    transactionCreateMock.mockRejectedValue(new Error('transient DB blip'));
    await expect(
      referralRewardJob.process({
        id: 'job-5',
        payload: { referredRiderId: 'rider-B', referralCode: 'CODE-A' },
      } as unknown as Parameters<typeof referralRewardJob.process>[0])
    ).rejects.toThrow('transient DB blip');
  });
});
