import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    rentalPlan: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => {
      const tx = {
        rider: {
          update: vi.fn().mockResolvedValue({}),
        },
      };
      return callback(tx);
    }),
  },
}));

vi.mock('@/lib/cache', () => ({
  invalidateRiderCache: vi.fn(),
  invalidateCache: vi.fn(),
}));

const { planUseCases } = await import('@/server/modules/plans/plan.use-cases');
const { db } = await import('@/lib/db');

describe('Plan Subscription — Higher Security Deposit for Skipped Guarantor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPlan = {
    id: 'plan_1',
    name: 'Weekly Saver',
    type: 'WEEKLY',
    durationDays: 7,
    priceInPaise: 150000, // ₹1,500
    securityDepositInPaise: 100000, // ₹1,000
    isActive: true,
  };

  it('allows normal security deposit when rider.requiresHigherDeposit is false', async () => {
    vi.mocked(db.rider.findUnique).mockResolvedValue({
      id: 'rider_1',
      lifecycleStatus: 'KYC_APPROVED',
      requiresHigherDeposit: false,
    } as any);
    vi.mocked(db.rentalPlan.findUnique).mockResolvedValue(mockPlan as any);

    // Submitting with ₹1,000 security deposit (paise: 100000)
    const result = await planUseCases.subscribeToPlan('rider_1', 'plan_1', false, 1000);
    expect(result.securityDeposit).toBe(1000);
    expect(result.price).toBe(1500);
  });

  it('rejects subscription when rider.requiresHigherDeposit is false and securityDeposit is below plan deposit', async () => {
    vi.mocked(db.rider.findUnique).mockResolvedValue({
      id: 'rider_1',
      lifecycleStatus: 'KYC_APPROVED',
      requiresHigherDeposit: false,
    } as any);
    vi.mocked(db.rentalPlan.findUnique).mockResolvedValue(mockPlan as any);

    // Submitting with ₹500 security deposit when plan requires ₹1,000
    await expect(
      planUseCases.subscribeToPlan('rider_1', 'plan_1', false, 500)
    ).rejects.toThrow('INSUFFICIENT_SECURITY_DEPOSIT');
  });

  it('rejects subscription when rider.requiresHigherDeposit is true and securityDeposit only covers standard plan deposit', async () => {
    vi.mocked(db.rider.findUnique).mockResolvedValue({
      id: 'rider_skip_guarantor',
      lifecycleStatus: 'KYC_APPROVED',
      requiresHigherDeposit: true,
    } as any);
    vi.mocked(db.rentalPlan.findUnique).mockResolvedValue(mockPlan as any);

    // Submitting with ₹1,000 (standard plan deposit), but skip-guarantor requires ₹1,000 extra (total ₹2,000)
    await expect(
      planUseCases.subscribeToPlan('rider_skip_guarantor', 'plan_1', false, 1000)
    ).rejects.toThrow('INSUFFICIENT_SECURITY_DEPOSIT');
  });

  it('accepts subscription when rider.requiresHigherDeposit is true and securityDeposit covers standard + extra deposit', async () => {
    vi.mocked(db.rider.findUnique).mockResolvedValue({
      id: 'rider_skip_guarantor',
      lifecycleStatus: 'KYC_APPROVED',
      requiresHigherDeposit: true,
    } as any);
    vi.mocked(db.rentalPlan.findUnique).mockResolvedValue(mockPlan as any);

    // Submitting with ₹2,000 (₹1,000 base + ₹1,000 extra)
    const result = await planUseCases.subscribeToPlan('rider_skip_guarantor', 'plan_1', false, 2000);
    expect(result.securityDeposit).toBe(2000);
    expect(result.planName).toBe('Weekly Saver');
  });

  it('defaults securityDeposit to standard + extra deposit when securityDeposit argument is omitted', async () => {
    vi.mocked(db.rider.findUnique).mockResolvedValue({
      id: 'rider_skip_guarantor',
      lifecycleStatus: 'KYC_APPROVED',
      requiresHigherDeposit: true,
    } as any);
    vi.mocked(db.rentalPlan.findUnique).mockResolvedValue(mockPlan as any);

    const result = await planUseCases.subscribeToPlan('rider_skip_guarantor', 'plan_1');
    expect(result.securityDeposit).toBe(2000);
  });
});
