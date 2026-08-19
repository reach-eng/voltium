import { expect, test, vi, describe, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getReferralBonusRupees } from '@/server/modules/referrals/referral.use-cases';
import { lifecycleRankOf } from '@/lib/lifecycle-ranks';
import * as cache from '@/lib/cache';

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/cache', () => ({
  getCachedResponse: vi.fn(),
  cacheResponse: vi.fn(),
}));

describe('Referral Bonus Math', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('getReferralBonusRupees returns the value from setting:referralBonus divided by 100', async () => {
    vi.mocked(cache.getCachedResponse).mockReturnValueOnce(null);
    vi.mocked(db.systemSetting.findFirst).mockResolvedValueOnce({
      id: '1',
      key: 'referralBonus',
      value: '25000',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const bonus = await getReferralBonusRupees();
    
    expect(bonus).toBe(250);
    expect(db.systemSetting.findFirst).toHaveBeenCalledWith({ where: { key: 'referralBonus' } });
    expect(cache.cacheResponse).toHaveBeenCalledWith('setting:referralBonus', '25000', 60);
  });

  test('When setting is 20000, bonus is 200 rupees (not 500)', async () => {
    vi.mocked(cache.getCachedResponse).mockReturnValueOnce(null);
    vi.mocked(db.systemSetting.findFirst).mockResolvedValueOnce({
      id: '1',
      key: 'referralBonus',
      value: '20000',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const bonus = await getReferralBonusRupees();
    
    expect(bonus).toBe(200);
  });

  test('lifecycleRankOf correctly identifies active statuses for referral rewards', () => {
    expect(lifecycleRankOf('ACTIVE')).toBe(11);
    
    // SUSPENDED, RETURN_PENDING, CLOSED are not considered active
    expect(lifecycleRankOf('SUSPENDED')).not.toBe(11);
    expect(lifecycleRankOf('RETURN_PENDING')).not.toBe(11);
    expect(lifecycleRankOf('CLOSED')).not.toBe(11);
  });
});
