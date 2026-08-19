import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    coupon: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  invalidateCache: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/cache', () => ({ invalidateCache: mocks.invalidateCache }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

import { couponUseCases } from '@/server/modules/coupons/coupon.use-cases';

describe('Coupon Fixed Discount Currency Conversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.db.coupon.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'cp_u', ...data })
    );
    mocks.db.coupon.findUnique.mockResolvedValue({ discountType: 'PERCENTAGE' });
  });

  it('converts FIXED discount value to paise (rupees * 100)', async () => {
    mocks.db.coupon.create.mockImplementation(({ data }) => Promise.resolve({ id: 'cp_1', ...data }));

    const coupon = await couponUseCases.create(
      {
        code: 'SAVE50',
        description: 'Save 50 rupees',
        discountType: 'FIXED',
        discountValue: 50,
        validFrom: '2026-08-01',
        validUntil: '2026-08-31',
        isActive: true,
      },
      'admin_1'
    );

    expect(mocks.db.coupon.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discountValueInPaise: 5000,
        }),
      })
    );
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:coupons:*');
    expect(coupon.discountValueInPaise).toBe(5000);
  });

  it('preserves percentage value directly without multiplying by 100', async () => {
    mocks.db.coupon.create.mockImplementation(({ data }) => Promise.resolve({ id: 'cp_2', ...data }));

    const coupon = await couponUseCases.create(
      {
        code: 'PERCENT20',
        description: '20 percent off',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        validFrom: '2026-08-01',
        validUntil: '2026-08-31',
        isActive: true,
      },
      'admin_1'
    );

    expect(mocks.db.coupon.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discountValueInPaise: 20,
        }),
      })
    );
    expect(coupon.discountValueInPaise).toBe(20);
  });

  it('update preserves PERCENTAGE value as-is (no *100) — SHIFTS P0-3', async () => {
    // PR-VER-2026-08-06 (SHIFTS P0-3): the old update only converted
    // `discountValue` for FIXED coupons. A PERCENTAGE update would reach
    // Prisma with the unknown `discountValue` field. Update must store
    // PERCENTAGE numbers verbatim and never leak `discountValue`.
    await couponUseCases.update('cp_u', { discountValue: 25 }, 'admin_1');

    expect(mocks.db.coupon.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discountValueInPaise: 25,
        }),
      })
    );
    const updateArg = mocks.db.coupon.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data.discountValue).toBeUndefined();
  });

  it('update converts FIXED value to paise and drops discountValue', async () => {
    mocks.db.coupon.findUnique.mockResolvedValue({ discountType: 'FIXED' });
    await couponUseCases.update('cp_u', { discountValue: 30 }, 'admin_1');

    const updateArg = mocks.db.coupon.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data.discountValueInPaise).toBe(3000);
    expect(updateArg.data.discountValue).toBeUndefined();
  });

  it('update with explicit FIXED type does not re-query the DB', async () => {
    await couponUseCases.update(
      'cp_u',
      { discountValue: 10, discountType: 'FIXED' },
      'admin_1'
    );
    expect(mocks.db.coupon.findUnique).not.toHaveBeenCalled();
    const updateArg = mocks.db.coupon.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data.discountValueInPaise).toBe(1000);
  });
});
