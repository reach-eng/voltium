import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireRiderSession: vi.fn(),
  listEarnings: vi.fn(),
  createEarning: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: mocks.requireRiderSession,
}));

vi.mock('@/server/modules/riders/rider.use-cases', () => ({
  riderUseCases: {
    listEarnings: mocks.listEarnings,
    createEarning: mocks.createEarning,
  },
}));

import { GET } from '@/app/api/rider/earnings/route';

describe('Earnings API route — query param parsing (P0-5, P1-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRiderSession.mockResolvedValue({ riderDbId: 'rider_1', phone: '98xxxx' });
    mocks.listEarnings.mockResolvedValue({
      earnings: [],
      weeklySummary: { totalEarnings: 0, totalTrips: 0, totalDistance: 0, totalHoursOnline: 0, daysWorked: 0 },
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
  });

  it('falls back gracefully to page 1 and limit 50 when non-numeric params are passed', async () => {
    const req = new NextRequest('http://localhost/api/rider/earnings?page=abc&limit=xyz');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mocks.listEarnings).toHaveBeenCalledWith('rider_1', {
      startDate: undefined,
      endDate: undefined,
      platform: undefined,
      page: 1,
      limit: 50,
    });
  });

  it('caps limit at 100 max and min page at 1 for negative values', async () => {
    const req = new NextRequest('http://localhost/api/rider/earnings?page=-5&limit=250');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mocks.listEarnings).toHaveBeenCalledWith('rider_1', {
      startDate: undefined,
      endDate: undefined,
      platform: undefined,
      page: 1,
      limit: 100,
    });
  });
});
