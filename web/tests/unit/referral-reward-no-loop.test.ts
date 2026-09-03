import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUniqueRider: vi.fn(),
  findUniqueSetting: vi.fn(),
  findUniqueLedger: vi.fn(),
  transaction: vi.fn(),
  credit: vi.fn(),
  emit: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: { findUnique: mocks.findUniqueRider },
    systemSetting: { findUnique: mocks.findUniqueSetting },
    walletLedger: { findUnique: mocks.findUniqueLedger },
    $transaction: mocks.transaction,
  },
}));
vi.mock('@/server/modules/wallet/wallet-ledger.service', () => ({
  walletLedgerService: { credit: mocks.credit },
}));
vi.mock('@/server/workers/outbox', () => ({
  OutboxService: { emit: mocks.emit },
  OutboxEventTypes: { REFERRAL_REWARD: 'referral.reward' },
}));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

import { referralRewardJob } from '@/server/workers/jobs/referral-reward.job';

describe('Referral Reward Self-Loop Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('credits referral reward without self-emitting REFERRAL_REWARD outbox event', async () => {
    // P0 fix 2026-09-03: job reads referrer, then referee (must be ACTIVE),
    // then the ledger key. Mock the sequence accordingly.
    mocks.findUniqueRider
      .mockResolvedValueOnce({
        id: 'r_referrer',
        wallet: { id: 'w_referrer' },
      })
      .mockResolvedValueOnce({ id: 'r_referred', lifecycleStatus: 'ACTIVE' });
    mocks.findUniqueLedger.mockResolvedValue(null);
    mocks.findUniqueSetting.mockResolvedValue({ value: '5000' });
    mocks.transaction.mockImplementation((cb: any) =>
      cb({
        transaction: { create: vi.fn().mockResolvedValue({ id: 'tx_1' }) },
        reward: { create: vi.fn().mockResolvedValue({ id: 'rw_1' }) },
      })
    );

    const res = await referralRewardJob.process({
      id: 'job_1',
      payload: { referredRiderId: 'r_referred', referralCode: 'REF123' },
    } as any);

    expect(res.rewardsCredited).toBe(1);
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  // PR-9 (2026-08-06 fix plan): Reward.points has two unit semantics — the
  // referral path stores PAISE (setting '5000' = ₹50 → points 5000), while
  // the manual admin award path stores a raw count. Pin the referral writer
  // so a future refactor can't silently switch it to rupees.
  it('stores Reward.points as PAISE (not rupees) for the referral bonus', async () => {
    const rewardCreate = vi.fn().mockResolvedValue({ id: 'rw_2' });
    mocks.findUniqueRider
      .mockResolvedValueOnce({
        id: 'r_referrer',
        wallet: { id: 'w_referrer' },
      })
      .mockResolvedValueOnce({ id: 'r_referred', lifecycleStatus: 'ACTIVE' });
    mocks.findUniqueLedger.mockResolvedValue(null);
    mocks.findUniqueSetting.mockResolvedValue({ value: '25000' }); // ₹250
    mocks.transaction.mockImplementation((cb: any) =>
      cb({
        transaction: { create: vi.fn().mockResolvedValue({ id: 'tx_2' }) },
        reward: { create: rewardCreate },
      })
    );

    await referralRewardJob.process({
      id: 'job_2',
      payload: { referredRiderId: 'r_referred', referralCode: 'REF124' },
    } as any);

    expect(rewardCreate).toHaveBeenCalledTimes(1);
    const arg = rewardCreate.mock.calls[0][0] as {
      data: { points: number };
    };
    expect(arg.data.points).toBe(25000);
  });
});
