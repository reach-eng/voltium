/**
 * TG (2026-08-05 rentals/vehicles/hubs audit) — route-level regression tests.
 *
 *   - P1.4:   admin rentals PUT validates the action via the closed Zod enum;
 *             a typo'd action is a 400 (the old `String.includes('RETURN')`
 *             gate let e.g. RETURNX into the return bucket). The permission is
 *             derived from the VALIDATED action, not a string match.
 *   - P1.7/P3.15: admin vehicles DELETE returns 404 on an unknown id and 409
 *             on an active lease instead of silently returning 200 with no
 *             write.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
  parsePaginationParams: vi.fn(() => ({ page: 1, limit: 20 })),
  hasPermission: vi.fn(),
  invalidateCache: vi.fn(),
  getOrSetResponse: vi.fn(),
  createAuditLog: vi.fn(() => Promise.resolve()),
  findLeaseById: vi.fn(),
  executeLeaseAction: vi.fn(),
  retireVehicle: vi.fn(),
  listAdminVehicles: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/rbac', () => ({
  requireAdmin: m.requireAdmin,
  adminUnauthorized: m.adminUnauthorized,
  adminForbidden: m.adminForbidden,
  parsePaginationParams: m.parsePaginationParams,
}));
vi.mock('@/lib/auth', () => ({ hasPermission: m.hasPermission }));
vi.mock('@/lib/cache', () => ({
  getOrSetResponse: m.getOrSetResponse,
  invalidateCache: m.invalidateCache,
}));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: m.createAuditLog }));
vi.mock('@/server/modules/rentals/rental.repository', () => ({
  rentalRepository: {
    findLeaseById: m.findLeaseById,
    executeLeaseAction: m.executeLeaseAction,
  },
}));
vi.mock('@/server/modules/vehicles/vehicle.use-cases', () => ({
  vehicleUseCases: {
    retireVehicle: m.retireVehicle,
    listAdminVehicles: m.listAdminVehicles,
  },
}));

import { PUT as rentalsPUT } from '@/app/api/admin/rentals/route';
import { DELETE as vehiclesDELETE } from '@/app/api/admin/vehicles/route';

function makeRequest(url: string, body?: Record<string, unknown>, method = 'PUT'): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// P1.4 — rentals PUT: closed Zod enum for the action
// ═══════════════════════════════════════════════════════════════════════════

describe('P1.4: rentals PUT validates the action via a closed Zod enum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue({
      adminId: 'admin_1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    m.hasPermission.mockReturnValue(true);
    m.findLeaseById.mockResolvedValue({ id: 'L1' });
    m.executeLeaseAction.mockResolvedValue({ id: 'L1', status: 'ACTIVE' });
    m.adminUnauthorized.mockReturnValue(new Response(null, { status: 401 }));
    m.adminForbidden.mockReturnValue(
      new Response(JSON.stringify({ success: false }), { status: 403 })
    );
  });

  it('400s a typo\'d action that the old includes() gate would have bucketed', async () => {
    const res = await rentalsPUT(makeRequest('/api/admin/rentals', { leaseId: 'L1', action: 'RETURNX' }));
    expect(res.status).toBe(400);
    expect(m.executeLeaseAction).not.toHaveBeenCalled();
    // The permission gate was never reached for the invalid action
    expect(m.hasPermission).not.toHaveBeenCalledWith('OPERATIONS_ADMIN', 'rentals_return_inspection');
  });

  it('400s on missing leaseId or action', async () => {
    const res1 = await rentalsPUT(makeRequest('/api/admin/rentals', { action: 'START' }));
    expect(res1.status).toBe(400);
    const res2 = await rentalsPUT(makeRequest('/api/admin/rentals', { leaseId: 'L1' }));
    expect(res2.status).toBe(400);
    expect(m.executeLeaseAction).not.toHaveBeenCalled();
  });

  it('maps REQUEST_RETURN to the return-inspection permission', async () => {
    const res = await rentalsPUT(makeRequest('/api/admin/rentals', { leaseId: 'L1', action: 'REQUEST_RETURN' }));
    expect(res.status).toBe(200);
    expect(m.hasPermission).toHaveBeenCalledWith('OPERATIONS_ADMIN', 'rentals_return_inspection');
    expect(m.executeLeaseAction).toHaveBeenCalledWith({ id: 'L1' }, 'REQUEST_RETURN');
  });

  it('maps START to the pickup-inspection permission', async () => {
    const res = await rentalsPUT(makeRequest('/api/admin/rentals', { leaseId: 'L1', action: 'start' }));
    expect(res.status).toBe(200);
    expect(m.hasPermission).toHaveBeenCalledWith('OPERATIONS_ADMIN', 'rentals_pickup_inspection');
    expect(m.executeLeaseAction).toHaveBeenCalledWith({ id: 'L1' }, 'START');
  });

  it('403s when the admin lacks the mapped permission', async () => {
    m.hasPermission.mockReturnValue(false);
    const res = await rentalsPUT(makeRequest('/api/admin/rentals', { leaseId: 'L1', action: 'CLOSE' }));
    expect(res.status).toBe(403);
    expect(m.executeLeaseAction).not.toHaveBeenCalled();
  });

  it('404s when the lease does not exist', async () => {
    m.findLeaseById.mockResolvedValue(null);
    const res = await rentalsPUT(makeRequest('/api/admin/rentals', { leaseId: 'nope', action: 'START' }));
    expect(res.status).toBe(404);
    expect(m.executeLeaseAction).not.toHaveBeenCalled();
  });

  it('invalidates the rental list cache after a successful action', async () => {
    await rentalsPUT(makeRequest('/api/admin/rentals', { leaseId: 'L1', action: 'SUSPEND' }));
    expect(m.invalidateCache).toHaveBeenCalledWith('admin:rentals:*');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1.7 / P3.15 — vehicles DELETE: 404 + active-lease 409
// ═══════════════════════════════════════════════════════════════════════════

describe('P1.7/P3.15: vehicles DELETE returns 404/409 instead of silent 200', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue({
      adminId: 'admin_1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    m.hasPermission.mockReturnValue(true);
    m.adminUnauthorized.mockReturnValue(new Response(null, { status: 401 }));
    m.adminForbidden.mockReturnValue(
      new Response(JSON.stringify({ success: false }), { status: 403 })
    );
    m.retireVehicle.mockResolvedValue({});
  });

  it('404s on an unknown vehicle id (old code returned 200 with no write)', async () => {
    m.retireVehicle.mockRejectedValue(new Error('VEHICLE_NOT_FOUND'));
    const res = await vehiclesDELETE(makeRequest('/api/admin/vehicles?id=typo', undefined, 'DELETE'));
    expect(res.status).toBe(404);
  });

  it('409s when the vehicle is on an active rental', async () => {
    m.retireVehicle.mockRejectedValue(new Error('VEHICLE_HAS_ACTIVE_LEASE'));
    const res = await vehiclesDELETE(makeRequest('/api/admin/vehicles?id=v1', undefined, 'DELETE'));
    expect(res.status).toBe(409);
  });

  it('400s when the id is missing', async () => {
    const res = await vehiclesDELETE(makeRequest('/api/admin/vehicles', undefined, 'DELETE'));
    expect(res.status).toBe(400);
    expect(m.retireVehicle).not.toHaveBeenCalled();
  });

  it('retires the vehicle and passes the acting admin id', async () => {
    const res = await vehiclesDELETE(makeRequest('/api/admin/vehicles?id=v1', undefined, 'DELETE'));
    expect(res.status).toBe(200);
    expect(m.retireVehicle).toHaveBeenCalledWith('v1', 'admin_1');
    expect(m.invalidateCache).toHaveBeenCalledWith('admin:*');
  });
});
