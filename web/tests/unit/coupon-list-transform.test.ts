import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    coupon: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  invalidateCache: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/cache', () => ({ invalidateCache: mocks.invalidateCache }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

import { couponUseCases } from '@/server/modules/coupons/coupon.use-cases';

describe('Coupon List Response Transformation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transforms discountValueInPaise and minAmount from paise to rupees for FIXED coupons', async () => {
    mocks.db.coupon.findMany.mockResolvedValue([
      {
        id: 'c_1',
        code: 'SAVE100',
        discountType: 'FIXED',
        discountValueInPaise: 10000,
        minAmount: 50000,
      },
      {
        id: 'c_2',
        code: 'PERCENT10',
        discountType: 'PERCENTAGE',
        discountValueInPaise: 10,
        minAmount: null,
      },
    ]);
    mocks.db.coupon.count.mockResolvedValue(2);

    const res = await couponUseCases.list(1, 20);
    expect(res.coupons[0].discountValue).toBe(100);
    expect(res.coupons[0].minAmount).toBe(500);

    expect(res.coupons[1].discountValue).toBe(10);
    expect(res.coupons[1].minAmount).toBeNull();
  });
});
