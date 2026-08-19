/**
 * TG-7 (2026-08-05 ops audit) — GET /api/pricing requires a rider session.
 *
 * The endpoint was unauthenticated: anyone could scrape per-hub utilization,
 * surge multipliers, and fleet counts (competitive intel). P0-7 gates it
 * behind requireRiderSession (the Flutter app already sends the rider JWT).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireRiderSession: vi.fn(),
  calculate: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: mocks.requireRiderSession,
}));

vi.mock('@/server/modules/pricing/pricing.use-cases', () => ({
  pricingUseCases: { calculate: mocks.calculate },
}));

import { GET } from '@/app/api/pricing/route';

function makeRequest(): NextRequest {
  const url = new URL('http://localhost/api/pricing?hubId=hub_1&basePrice=100');
  return new NextRequest(url);
}

describe('TG-7: pricing requires rider auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calculate.mockResolvedValue({ dynamicPrice: 120 });
  });

  it('rejects unauthenticated requests', async () => {
    mocks.requireRiderSession.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mocks.calculate).not.toHaveBeenCalled();
  });

  it('rejects admin tokens on rider endpoints (forbidden)', async () => {
    mocks.requireRiderSession.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    );
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('calculates price for an authenticated rider', async () => {
    mocks.requireRiderSession.mockResolvedValue({ riderDbId: 'rider_1', phone: '98xxxx' });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.calculate).toHaveBeenCalledWith('hub_1', 100);
  });
});
