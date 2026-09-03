/**
 * F-10: Admin rider actions route — END_RENTAL tests
 *
 * Verifies:
 * 1. POST /api/admin/riders/actions with action 'END_RENTAL' calls adminRiderUseCases.endRental
 * 2. Catches RiderLifecycleError and responds with 400 Bad Request
 * 3. Catches unexpected errors and responds with 500 Internal Error
 * 4. Checks admin auth and permissions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { RiderLifecycleError } from '@/server/modules/riders/rider-lifecycle.service';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
  hasPermission: vi.fn(),
  endRental: vi.fn(),
  getRiderWithWallet: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 403 }),
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: mocks.hasPermission,
}));

vi.mock('@/server/modules/riders/admin-riders.use-cases', () => ({
  adminRiderUseCases: {
    endRental: mocks.endRental,
    getRiderWithWallet: mocks.getRiderWithWallet,
  },
}));

vi.mock('@/lib/sign-rider', () => ({
  signRiderUrls: vi.fn((rider) => Promise.resolve(rider)),
}));

import { POST } from '@/app/api/admin/riders/actions/route';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/riders/actions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/admin/riders/actions — END_RENTAL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin_123',
      adminRole: 'SUPER_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.getRiderWithWallet.mockResolvedValue({
      id: 'rider_123',
      lifecycleStatus: 'RETURN_PENDING',
      vehicleReturns: [],
    });
    mocks.endRental.mockResolvedValue({
      id: 'rider_123',
      lifecycleStatus: 'CLOSED',
      assignedVehicle: null,
      vehicleReturns: [],
    });
  });

  it('returns 200 and terminates rental successfully', async () => {
    const res = await POST(
      makeRequest({
        riderId: 'rider_123',
        action: 'END_RENTAL',
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe('Rental terminated successfully');
    expect(mocks.endRental).toHaveBeenCalledWith('rider_123', 'admin_123');
  });

  it('returns 400 Bad Request when RiderLifecycleError is thrown', async () => {
    mocks.endRental.mockRejectedValue(
      new RiderLifecycleError('Invalid transition from NEW to CLOSED', 'NEW' as any, 'CLOSED' as any)
    );

    const res = await POST(
      makeRequest({
        riderId: 'rider_123',
        action: 'END_RENTAL',
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toContain('Invalid transition from NEW to CLOSED');
  });

  it('returns 500 when an unexpected internal error is thrown', async () => {
    mocks.endRental.mockRejectedValue(new Error('Unexpected DB crash'));

    const res = await POST(
      makeRequest({
        riderId: 'rider_123',
        action: 'END_RENTAL',
      })
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toBe('Failed to perform admin action');
  });

  it('returns 401 when admin is unauthenticated', async () => {
    mocks.requireAdmin.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        riderId: 'rider_123',
        action: 'END_RENTAL',
      })
    );

    expect(res.status).toBe(401);
  });

  it('returns 403 when admin lacks riders_update permission', async () => {
    mocks.hasPermission.mockReturnValue(false);

    const res = await POST(
      makeRequest({
        riderId: 'rider_123',
        action: 'END_RENTAL',
      })
    );

    expect(res.status).toBe(403);
  });
});
