import { describe, it, expect } from 'vitest';
import { subscribePlanSchema } from '@/lib/validators';

describe('Subscribe Plan Schema Fields', () => {
  it('validates planId and accepts optional hubId, securityDeposit, advanceRentPaid', () => {
    const res = subscribePlanSchema.safeParse({
      planId: 'plan_daily',
      hubId: 'hub_koramangala',
      securityDeposit: 1500,
      advanceRentPaid: 180,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.planId).toBe('plan_daily');
      expect(res.data.hubId).toBe('hub_koramangala');
      expect(res.data.securityDeposit).toBe(1500);
      expect(res.data.advanceRentPaid).toBe(180);
    }
  });

  it('accepts boolean advanceRentPaid from Flutter client', () => {
    const res = subscribePlanSchema.safeParse({
      planId: 'plan_daily',
      advanceRentPaid: true,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.advanceRentPaid).toBe(true);
    }
  });
});
