import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    riderEarning: {
      findMany: mocks.findMany,
      count: mocks.count,
      aggregate: mocks.aggregate,
    },
  },
}));

import { earningRepository } from '@/server/modules/earnings/earning.repository';

describe('Case-Insensitive Rider Search in Earning Repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    mocks.aggregate.mockResolvedValue({ _sum: { amount: 0, trips: 0 }, _avg: { amount: 0 } });
  });

  it('applies mode: insensitive to rider search filters', async () => {
    await earningRepository.findAllPaginated({
      search: 'Rider 123',
      page: 1,
      limit: 10,
    });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          rider: {
            OR: [
              { fullName: { contains: 'Rider 123', mode: 'insensitive' } },
              { riderId: { contains: 'Rider 123', mode: 'insensitive' } },
            ],
          },
        }),
      })
    );
  });
});
