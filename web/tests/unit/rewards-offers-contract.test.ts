import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getReferrals } from '@/app/api/rider/referrals/route';
import { GET as getRewards } from '@/app/api/rider/rewards/route';
import { referralUseCases } from '@/server/modules/referrals/referral.use-cases';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { offerUseCases } from '@/server/modules/offers/offer.use-cases';
import * as riderAuth from '@/lib/rider-auth';
import { db } from '@/lib/db';

vi.mock('@/lib/rider-auth');
vi.mock('@/server/modules/referrals/referral.use-cases');
vi.mock('@/server/modules/riders/rider.use-cases');
vi.mock('@/lib/db', () => ({
  db: {
    offer: {
      findMany: vi.fn(),
    },
  },
}));

describe('Rewards and Offers Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(riderAuth.requireRiderSession).mockResolvedValue({ riderDbId: 'mock-rider-id', phone: '9876543210' } as any);
  });

  describe('Referrals (Task 1)', () => {
    it('returns 200 OK with empty structure instead of 404', async () => {
      vi.mocked(referralUseCases.getReferrals).mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/rider/referrals');
      const response = await getReferrals(req);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual({
        referralCode: null,
        stats: { totalLeads: 0, activeRiders: 0, totalEarnings: 0 },
        referrals: [],
      });
    });
  });

  describe('Rewards (Task 2)', () => {
    it('returns 200 OK with empty structure instead of 404', async () => {
      vi.mocked(riderUseCases.getRewards).mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/rider/rewards');
      const response = await getRewards(req);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual({
        rewards: [],
        totalPoints: 0,
        thisMonthPoints: 0,
        currentStreak: 0,
      });
    });
  });

  describe('Offers (Task 3)', () => {
    it('getActiveSponsored applies take: 50 constraint', async () => {
      vi.mocked(db.offer.findMany).mockResolvedValue([]);
      await offerUseCases.getActiveSponsored();
      expect(db.offer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });
});
