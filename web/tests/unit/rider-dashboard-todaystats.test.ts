import { describe, it, expect, vi, beforeEach } from 'vitest';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    rider: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    notification: { count: vi.fn() },
    rentalLease: { findFirst: vi.fn() },
  },
}));

describe('riderUseCases.getDashboard — todayStats (RIDER_DASHBOARD P0-9)', () => {
  const baseRider = {
    id: 'rider-1',
    riderId: 'R1001',
    fullName: 'John Doe',
    phone: '+919876543210',
    lifecycleStatus: 'ACTIVE',
    referralCode: 'JOHN1001',
    wallet: {
      balanceInPaise: 30000,
      securityDeposit: 0,
      depositStatus: 'APPROVED',
      paymentStreak: 2,
    },
    kycProfile: null,
    guarantor: null,
    vehicleReturns: [],
    depositRecord: null,
    vehicle: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (db.rider.findUnique as any).mockResolvedValue(baseRider);
    (db.notification.count as any).mockResolvedValue(0);
  });

  it('reports null telemetry with dataAvailable false and battery from the joined vehicle', async () => {
    (db.rider.findUnique as any).mockResolvedValue({
      ...baseRider,
      vehicle: { batteryLevel: 78 },
    });

    const result = await riderUseCases.getDashboard('rider-1');

    expect(result).not.toBeNull();
    expect(result!.todayStats).toEqual({
      distance: null,
      power: null,
      speed: null,
      dataAvailable: false,
      battery: 78,
    });
  });

  it('falls back to battery 0 and never fabricates zeros when there is no telemetry source', async () => {
    const result = await riderUseCases.getDashboard('rider-1');

    expect(result).not.toBeNull();
    // The old shape returned 0/0/0 which the rider app rendered as real
    // stats. The fixed shape must be null + dataAvailable:false so the app
    // shows a "not yet available" placeholder instead.
    expect(result!.todayStats).toEqual({
      distance: null,
      power: null,
      speed: null,
      dataAvailable: false,
      battery: 0,
    });
    expect(result!.todayStats).not.toEqual(
      expect.objectContaining({
        distance: 0,
        power: 0,
        speed: 0,
        dataAvailable: true,
      })
    );
  });
});
