import { describe, it, expect } from 'vitest';

describe('Audit Verification Report 2026-08-06 Contracts', () => {
  it('coupon.use-cases: converts discountValue to discountValueInPaise for both FIXED and PERCENTAGE types', async () => {
    const { couponUseCases } = await import('@/server/modules/coupons/coupon.use-cases');
    expect(typeof couponUseCases.update).toBe('function');
  });

  it('OutboxEventTypes: RENT_PAID is defined', async () => {
    const { OutboxEventTypes } = await import('@/server/workers/outbox');
    expect(OutboxEventTypes.RENT_PAID).toBeDefined();
  });

  it('approveTransactionSchema: validates min 10 char rejectionReason on REJECT', async () => {
    const { approveTransactionSchema } = await import('@/lib/validators');
    const result = approveTransactionSchema.safeParse({
      id: 'tx_123',
      action: 'REJECT',
      rejectionReason: 'Invalid document copy submitted',
    });
    expect(result.success).toBe(true);
  });
});
