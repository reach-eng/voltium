import { it, expect, describe, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  countRider: vi.fn().mockResolvedValue(100),
  findManyRider: vi.fn().mockResolvedValue([
    { createdAt: new Date('2026-01-15T10:00:00Z'), lifecycleStatus: 'ACTIVE' },
    { createdAt: new Date('2026-01-20T10:00:00Z'), lifecycleStatus: 'SUSPENDED' },
  ]),
  countVehicle: vi.fn().mockResolvedValue(50),
  aggregateTransaction: vi.fn().mockResolvedValue({ _sum: { amountInPaise: 5000000 } }),
  groupByTransaction: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: mocks.queryRaw,
    rider: {
      count: mocks.countRider,
      findMany: mocks.findManyRider,
    },
    vehicle: {
      count: mocks.countVehicle,
    },
    transaction: {
      aggregate: mocks.aggregateTransaction,
      groupBy: mocks.groupByTransaction,
    },
  },
}));

import { analyticsUseCases } from '@/server/modules/analytics/analytics.use-cases';

describe('P0-5: Analytics pure Prisma aggregations — zero raw SQL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs getOverview without calling db.$queryRaw', async () => {
    const result = await analyticsUseCases.getOverview();

    expect(mocks.queryRaw).not.toHaveBeenCalled();
    expect(mocks.findManyRider).toHaveBeenCalled();
    expect(result.overview.totalRiders).toBe(100);
    expect(result.cohorts.length).toBeGreaterThan(0);
    expect(result.cohorts[0].total).toBe(2);
    expect(result.cohorts[0].active).toBe(1);
    expect(result.cohorts[0].suspended).toBe(1);
  });
});
