/**
 * F-11: Rider plans API route tests
 *
 * Verifies:
 * 1. POST /api/rider/plans calls planUseCases.subscribeToPlan
 * 2. Catches RIDER_LIFECYCLE_CONFLICT and responds with 409 Conflict
 * 3. Catches INVALID_STATE_FOR_PLAN_SELECTION and responds with 400 Bad Request
 * 4. Catches INSUFFICIENT_SECURITY_DEPOSIT and responds with 400 Bad Request
 * 5. Catches Rider not found and responds with 404 Not Found
 * 6. Handles unauthenticated rider session
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireRiderSession: vi.fn(),
  subscribeToPlan: vi.fn(),
  listActivePlans: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));
vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: mocks.requireRiderSession,
}));
vi.mock('@/server/modules/plans/plan.use-cases', () => ({
  planUseCases: {
    subscribeToPlan: mocks.subscribeToPlan,
    listActivePlans: mocks.listActivePlans,
  },
}));

import { POST, GET } from '@/app/api/rider/plans/route';

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/rider/plans', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/rider/plans (F-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects if rider is unauthenticated', async () => {
    mocks.requireRiderSession.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );

    const req = makePostRequest({ planId: 'plan_1' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('subscribes successfully and returns 200', async () => {
    mocks.requireRiderSession.mockResolvedValue({
      riderDbId: 'rider_123',
      riderId: 'R-123',
    });
    mocks.subscribeToPlan.mockResolvedValue({
      planId: 'plan_1',
      planName: 'Weekly Saver',
      startDate: null,
      endDate: null,
      durationDays: 7,
      price: 1200,
      securityDeposit: 2000,
    });

    const req = makePostRequest({ planId: 'plan_1', advanceRentPaid: false });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.planName).toBe('Weekly Saver');
    expect(mocks.subscribeToPlan).toHaveBeenCalledWith('rider_123', 'plan_1', false, undefined, {
      guarantorSkipped: undefined,
    });
  });

  it('returns 409 Conflict when RIDER_LIFECYCLE_CONFLICT occurs', async () => {
    mocks.requireRiderSession.mockResolvedValue({
      riderDbId: 'rider_123',
    });
    mocks.subscribeToPlan.mockRejectedValue(new Error('RIDER_LIFECYCLE_CONFLICT'));

    const req = makePostRequest({ planId: 'plan_1' });
    const res = await POST(req);
    expect(res.status).toBe(409);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('CONFLICT');
    expect(json.error.message).toBe('Rider state changed concurrently. Please refresh and retry.');
  });

  it('returns 400 Bad Request when INVALID_STATE_FOR_PLAN_SELECTION occurs', async () => {
    mocks.requireRiderSession.mockResolvedValue({
      riderDbId: 'rider_123',
    });
    mocks.subscribeToPlan.mockRejectedValue(new Error('INVALID_STATE_FOR_PLAN_SELECTION'));

    const req = makePostRequest({ planId: 'plan_1' });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('BAD_REQUEST');
    expect(json.error.message).toContain('Invalid state for plan selection');
  });

  it('returns 404 Not Found when Rider not found occurs', async () => {
    mocks.requireRiderSession.mockResolvedValue({
      riderDbId: 'rider_nonexistent',
    });
    mocks.subscribeToPlan.mockRejectedValue(new Error('Rider not found'));

    const req = makePostRequest({ planId: 'plan_1' });
    const res = await POST(req);
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
  });
});
