import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  riderFindUnique: vi.fn(),
  riderUpdate: vi.fn(),
  vehicleFindUnique: vi.fn(),
  notificationCount: vi.fn(),
  rentalLeaseFindFirst: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/db', () => ({
  db: {
    rider: { findUnique: mocks.riderFindUnique, update: mocks.riderUpdate },
    vehicle: { findUnique: mocks.vehicleFindUnique },
    notification: { count: mocks.notificationCount },
    rentalLease: { findFirst: mocks.rentalLeaseFindFirst },
  },
}));

vi.mock('@/lib/sign-rider', () => ({
  signRiderUrls: vi.fn((data) => Promise.resolve(data)),
}));

import { riderUseCases } from '@/server/modules/riders/rider.use-cases';

describe('Dashboard PII and Query Optimization (P0-3, P0-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.riderUpdate.mockResolvedValue({});
    mocks.notificationCount.mockResolvedValue(0);
    mocks.rentalLeaseFindFirst.mockResolvedValue(null);
  });

  it('excludes PII fields (aadhaarNumber, panNumber, bankName, accountNumber, ifscCode) from select', async () => {
    mocks.riderFindUnique.mockResolvedValue({
      id: 'rider_1',
      fullName: 'Test Rider',
      riderId: 'RDR001',
      kycProfile: {
        status: 'APPROVED',
        profilePhoto: 'http://img.com/p.jpg',
      },
    });

    await riderUseCases.getDashboard('rider_1');

    expect(mocks.riderFindUnique).toHaveBeenCalled();
    const selectArg = mocks.riderFindUnique.mock.calls[0][0].select;
    const kycSelect = selectArg.kycProfile.select;

    expect(kycSelect).not.toHaveProperty('aadhaarNumber');
    expect(kycSelect).not.toHaveProperty('panNumber');
    expect(kycSelect).not.toHaveProperty('bankName');
    expect(kycSelect).not.toHaveProperty('accountNumber');
    expect(kycSelect).not.toHaveProperty('ifscCode');
  });

  it('uses vehicle data from initial query without making an extra vehicle.findUnique query (P0-4)', async () => {
    mocks.riderFindUnique.mockResolvedValue({
      id: 'rider_1',
      fullName: 'Test Rider',
      riderId: 'RDR001',
      vehicle: {
        id: 'v_1',
        vehicleId: 'V100',
        vehicleNumber: 'KA-01-EV-1234',
        model: 'VoltX',
      },
    });

    const dashboard = await riderUseCases.getDashboard('rider_1');

    expect(dashboard).not.toBeNull();
    expect(dashboard?.rider.assignedVehicle).toBe('KA-01-EV-1234');
    expect(mocks.vehicleFindUnique).not.toHaveBeenCalled();
  });

  it('persists generated referralCode to database on first load (P1-11)', async () => {
    mocks.riderFindUnique.mockResolvedValue({
      id: 'rider_1',
      fullName: 'John Doe',
      riderId: 'RDR123456',
      referralCode: null,
    });
    mocks.riderUpdate.mockResolvedValue({});

    const dashboard = await riderUseCases.getDashboard('rider_1');

    expect(dashboard?.referralCode).toBe('JOHN123456');
    expect(mocks.riderUpdate).toHaveBeenCalledWith({
      where: { id: 'rider_1' },
      data: { referralCode: 'JOHN123456' },
    });
  });

  it('formats actual due datetime in upcomingRentPrompt (P2-14)', async () => {
    const dueAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    mocks.riderFindUnique.mockResolvedValue({
      id: 'rider_1',
      fullName: 'John Doe',
      referralCode: 'REF123',
      wallet: { balanceInPaise: 5000 },
    });
    mocks.rentalLeaseFindFirst.mockResolvedValue({
      id: 'lease_1',
      finalPriceInPaise: 10000,
      nextRentDueAt: dueAt,
    });

    const dashboard = await riderUseCases.getDashboard('rider_1');

    expect(dashboard?.upcomingRentPrompt).not.toBeNull();
    expect(dashboard?.upcomingRentPrompt?.dueTimeFormatted).toMatch(/^Due today at \d{1,2}:\d{2} (AM|PM)$/);
  });
});
