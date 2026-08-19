import { describe, it, expect, vi, beforeEach } from 'vitest';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { db } from '@/lib/db';
import { clock } from '@/lib/clock';

vi.mock('@/lib/db', () => ({
  db: {
    rider: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    notification: { count: vi.fn() },
    rentalLease: { findFirst: vi.fn() },
  },
}));

describe('riderUseCases.getDashboard - upcomingRentPrompt', () => {
  const mockRider = {
    id: 'rider-1',
    riderId: 'R1001',
    fullName: 'John Doe',
    phone: '+919876543210',
    lifecycleStatus: 'ACTIVE',
    wallet: { balanceInPaise: 30000 }, // ₹300
    kycProfile: null,
    guarantor: null,
    vehicleReturns: [],
    depositRecord: null,
    vehicle: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (db.rider.findUnique as any).mockResolvedValue(mockRider);
    (db.notification.count as any).mockResolvedValue(0);
  });

  it('returns upcomingRentPrompt when active lease is due within 24 hours with shortfall', async () => {
    const now = new Date('2026-08-04T10:00:00Z');
    vi.spyOn(clock, 'now').mockReturnValue(now);

    const dueAt = new Date('2026-08-05T00:30:00Z'); // 14.5 hours from now
    (db.rentalLease.findFirst as any).mockResolvedValue({
      id: 'lease-101',
      finalPriceInPaise: 50000, // ₹500
      nextRentDueAt: dueAt,
    });

    const result = await riderUseCases.getDashboard('rider-1');

    expect(result).not.toBeNull();
    expect(result!.upcomingRentPrompt).toEqual({
      showPrompt: true,
      leaseId: 'lease-101',
      rentAmountInRupees: 500,
      walletBalanceInRupees: 300,
      shortfallInRupees: 200,
      recommendedTopUpRupees: 200,
      dueDate: dueAt.toISOString(),
      dueTimeFormatted: expect.stringMatching(/Due|Tomorrow|Overdue/),
      requiresTopUp: true,
    });
  });

  it('returns upcomingRentPrompt with requiresTopUp false when balance covers rent', async () => {
    const now = new Date('2026-08-04T10:00:00Z');
    vi.spyOn(clock, 'now').mockReturnValue(now);

    const dueAt = new Date('2026-08-05T00:30:00Z');
    (db.rider.findUnique as any).mockResolvedValue({
      ...mockRider,
      wallet: { balanceInPaise: 60000 }, // ₹600 >= ₹500
    });
    (db.rentalLease.findFirst as any).mockResolvedValue({
      id: 'lease-102',
      finalPriceInPaise: 50000,
      nextRentDueAt: dueAt,
    });

    const result = await riderUseCases.getDashboard('rider-1');

    expect(result).not.toBeNull();
    expect(result!.upcomingRentPrompt).toEqual({
      showPrompt: true,
      leaseId: 'lease-102',
      rentAmountInRupees: 500,
      walletBalanceInRupees: 600,
      shortfallInRupees: 0,
      recommendedTopUpRupees: 500,
      dueDate: dueAt.toISOString(),
      dueTimeFormatted: expect.stringMatching(/Due|Tomorrow|Overdue/),
      requiresTopUp: false,
    });
  });

  it('returns null upcomingRentPrompt if rent due is more than 24 hours away', async () => {
    const now = new Date('2026-08-04T10:00:00Z');
    vi.spyOn(clock, 'now').mockReturnValue(now);

    const dueAt = new Date('2026-08-05T12:00:00Z'); // 26 hours away
    (db.rentalLease.findFirst as any).mockResolvedValue({
      id: 'lease-103',
      finalPriceInPaise: 50000,
      nextRentDueAt: dueAt,
    });

    const result = await riderUseCases.getDashboard('rider-1');

    expect(result).not.toBeNull();
    expect(result!.upcomingRentPrompt).toBeNull();
  });

  it('returns null upcomingRentPrompt if no active lease exists', async () => {
    (db.rentalLease.findFirst as any).mockResolvedValue(null);

    const result = await riderUseCases.getDashboard('rider-1');

    expect(result).not.toBeNull();
    expect(result!.upcomingRentPrompt).toBeNull();
  });
});
