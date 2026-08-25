import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { db } from '@/lib/db';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { POST } from '@/app/api/rider/rewards/[id]/redeem/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: vi.fn(),
    },
    reward: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: vi.fn(),
}));

vi.mock('@/server/modules/wallet/wallet-ledger.service', () => ({
  walletLedgerService: {
    credit: vi.fn(),
  },
}));

vi.mock('@/lib/server-cache', () => ({
  getCachedRider: vi.fn((id, fn) => fn()),
  invalidateRiderCache: vi.fn(),
}));

describe('Tier System & Reward Redemption', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tier Calculation (getRewards)', () => {
    it('should calculate Bronze tier correctly', async () => {
      vi.mocked(db.rider.findUnique).mockResolvedValue({ wallet: { paymentStreak: 5 } } as any);
      vi.mocked(db.reward.findMany).mockResolvedValue([]);
      vi.mocked(db.reward.aggregate).mockResolvedValue({ _sum: { points: 100 } } as any);

      const result = await riderUseCases.getRewards('rider-1');
      expect(result?.tier.currentTier).toBe('Bronze');
      expect(result?.tier.nextTierThreshold).toBe(2000);
      expect(result?.tier.progress).toBe(100 / 2000);
      expect(result?.tier.pointsToNext).toBe(1900);
    });

    it('should calculate Silver tier correctly', async () => {
      vi.mocked(db.rider.findUnique).mockResolvedValue({ wallet: { paymentStreak: 5 } } as any);
      vi.mocked(db.reward.findMany).mockResolvedValue([]);
      vi.mocked(db.reward.aggregate).mockResolvedValue({ _sum: { points: 2500 } } as any);

      const result = await riderUseCases.getRewards('rider-1');
      expect(result?.tier.currentTier).toBe('Silver');
      expect(result?.tier.nextTierThreshold).toBe(5000);
      expect(result?.tier.progress).toBe(2500 / 5000);
      expect(result?.tier.pointsToNext).toBe(2500);
    });

    it('should calculate Gold tier correctly', async () => {
      vi.mocked(db.rider.findUnique).mockResolvedValue({ wallet: { paymentStreak: 5 } } as any);
      vi.mocked(db.reward.findMany).mockResolvedValue([]);
      vi.mocked(db.reward.aggregate).mockResolvedValue({ _sum: { points: 6000 } } as any);

      const result = await riderUseCases.getRewards('rider-1');
      expect(result?.tier.currentTier).toBe('Gold');
      expect(result?.tier.nextTierThreshold).toBe(5000);
      expect(result?.tier.progress).toBe(1.0);
      expect(result?.tier.pointsToNext).toBe(0);
    });
  });

  describe('Reward Redemption Route', () => {
    it('should redeem a reward successfully', async () => {
      const { requireRiderSession } = await import('@/lib/rider-auth');
      vi.mocked(requireRiderSession).mockResolvedValue({ riderDbId: 'rider-1', phone: '9876543210' } as any);

      vi.mocked(db.reward.findUnique).mockResolvedValue({
        id: 'reward-1',
        riderId: 'rider-1',
        points: 5000,
        title: 'Test Reward',
        redeemedAt: null,
      } as any);

      vi.mocked(db.reward.updateMany).mockResolvedValue({ count: 1 } as any);

      vi.mocked(db.$transaction).mockImplementation(async (cb: any) => {
        return cb(db);
      });

      vi.mocked(db.transaction.create).mockResolvedValue({ id: 'txn-1' } as any);

      const req = new NextRequest('http://localhost/api/rider/rewards/reward-1/redeem', { method: 'POST' });
      const res = await POST(req, { params: Promise.resolve({ id: 'reward-1' }) });

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.rewardId).toBe('reward-1');
      expect(json.data.redeemedAt).toBeDefined();

      expect(db.reward.updateMany).toHaveBeenCalledWith({
        where: { id: 'reward-1', redeemedAt: null },
        data: { redeemedAt: expect.any(Date) },
      });

      expect(walletLedgerService.credit).toHaveBeenCalledWith({
        riderId: 'rider-1',
        amountInPaise: 5000,
        category: 'REWARD',
        txnId: 'txn-1',
        idempotencyKey: 'redeem-reward:reward-1',
        note: 'Reward redemption: Test Reward',
      }, db);
    });

    it('should fail if reward already redeemed', async () => {
      const { requireRiderSession } = await import('@/lib/rider-auth');
      vi.mocked(requireRiderSession).mockResolvedValue({ riderDbId: 'rider-1', phone: '9876543210' } as any);

      vi.mocked(db.reward.findUnique).mockResolvedValue({
        id: 'reward-1',
        riderId: 'rider-1',
        points: 5000,
        title: 'Test Reward',
        redeemedAt: new Date(),
      } as any);

      const req = new NextRequest('http://localhost/api/rider/rewards/reward-1/redeem', { method: 'POST' });
      const res = await POST(req, { params: Promise.resolve({ id: 'reward-1' }) });

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Reward already redeemed');
    });

    it('should fail if reward belongs to another rider', async () => {
      const { requireRiderSession } = await import('@/lib/rider-auth');
      vi.mocked(requireRiderSession).mockResolvedValue({ riderDbId: 'rider-2', phone: '9876543211' } as any);

      vi.mocked(db.reward.findUnique).mockResolvedValue({
        id: 'reward-1',
        riderId: 'rider-1',
        points: 5000,
        title: 'Test Reward',
        redeemedAt: null,
      } as any);

      const req = new NextRequest('http://localhost/api/rider/rewards/reward-1/redeem', { method: 'POST' });
      const res = await POST(req, { params: Promise.resolve({ id: 'reward-1' }) });

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Unauthorized access to reward');
    });
  });
});
