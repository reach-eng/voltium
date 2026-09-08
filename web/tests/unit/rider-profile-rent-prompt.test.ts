import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  riderFindUnique: vi.fn(),
  notificationCount: vi.fn(),
  rewardAggregate: vi.fn(),
  rentalLeaseFindFirst: vi.fn(),
  vehicleFindUnique: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

// Bypass the server cache — invoke the fetcher directly.
vi.mock('@/lib/server-cache', () => ({
  getCachedRider: vi.fn((_id: string, fetcher: () => unknown) => fetcher()),
  invalidateRiderCache: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: { findUnique: mocks.riderFindUnique },
    vehicle: { findUnique: mocks.vehicleFindUnique },
    notification: { count: mocks.notificationCount },
    reward: { aggregate: mocks.rewardAggregate },
    rentalLease: { findFirst: mocks.rentalLeaseFindFirst },
  },
}));

import { riderUseCases } from '@/server/modules/riders/rider.use-cases';

describe('Profile carries the rent prompt (dashboard P0-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.riderFindUnique.mockResolvedValue({
      id: 'rider_1',
      riderId: 'RDR001',
      fullName: 'Test Rider',
      referralCode: 'TEST0001',
      lifecycleStatus: 'ACTIVE',
      wallet: { balanceInPaise: 1000 },
    });
    mocks.notificationCount.mockResolvedValue(0);
    mocks.rewardAggregate.mockResolvedValue({ _sum: { points: 0 } });
  });

  it('includes upcomingRentPrompt when a lease is due within 24h', async () => {
    mocks.rentalLeaseFindFirst.mockResolvedValue({
      id: 'lease_1',
      finalPriceInPaise: 10000,
      nextRentDueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const profile = await riderUseCases.getProfile('rider_1');

    expect(profile?.upcomingRentPrompt).not.toBeNull();
    expect(profile?.upcomingRentPrompt?.showPrompt).toBe(true);
  });

  it('degrades to null prompt when the rent lookup fails', async () => {
    mocks.rentalLeaseFindFirst.mockRejectedValue(new Error('db down'));

    const profile = await riderUseCases.getProfile('rider_1');

    expect(profile).not.toBeNull();
    expect(profile?.upcomingRentPrompt).toBeNull();
  });

  it('returns null prompt when no lease is due soon', async () => {
    mocks.rentalLeaseFindFirst.mockResolvedValue(null);

    const profile = await riderUseCases.getProfile('rider_1');

    expect(profile?.upcomingRentPrompt).toBeNull();
  });
});
