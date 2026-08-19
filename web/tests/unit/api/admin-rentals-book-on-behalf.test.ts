/**
 * P2.10 (2026-08-05 rentals/vehicles/hubs audit) — admin book-rental-on-behalf.
 *
 * Verifies the new POST /api/admin/rentals/book-on-behalf route:
 *   - 401 without an admin session.
 *   - 403 without the `rentals_book` permission.
 *   - 422 on schema validation failure (strict schema — unknown keys 422).
 *   - 404 when the rider cannot be resolved (by public riderId or db id).
 *   - 200: bookRental is called with the RESOLVED db id; the acting admin is
 *     written to the audit log; admin:rentals:* + rider cache invalidated.
 *   - completePickup: true chains completePickupVerification with
 *     verifiedBy = adminId; false skips it.
 *   - PickupVerificationError (photos required / wrong lifecycle) → 400.
 *   - RentalBookError CONFLICT (fully booked) → 409 via withApiHandler.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { RentalBookError } from '@/server/modules/rentals/use-cases/errors';

const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
  hasPermission: vi.fn(),
  findFirstRider: vi.fn(),
  invalidateCache: vi.fn(),
  invalidateRiderCache: vi.fn(),
  createAuditLog: vi.fn(() => Promise.resolve()),
  bookRental: vi.fn(),
  completePickupVerification: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: m.requireAdmin,
  adminUnauthorized: m.adminUnauthorized,
  adminForbidden: m.adminForbidden,
}));
vi.mock('@/lib/auth', () => ({ hasPermission: m.hasPermission }));
vi.mock('@/lib/db', () => ({
  db: { rider: { findFirst: m.findFirstRider } },
}));
vi.mock('@/lib/cache', () => ({ invalidateCache: m.invalidateCache }));
vi.mock('@/lib/server-cache', () => ({ invalidateRiderCache: m.invalidateRiderCache }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: m.createAuditLog }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/server/modules/rentals/rental.use-cases', () => ({
  rentalUseCases: { bookRental: m.bookRental },
}));
// Keep the REAL PickupVerificationError class (the route checks instanceof)
// but stub the use-case function.
vi.mock('@/server/modules/pickup/use-cases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/modules/pickup/use-cases')>();
  return { ...actual, completePickupVerification: m.completePickupVerification };
});

import { POST } from '@/app/api/admin/rentals/book-on-behalf/route';
import { PickupVerificationError } from '@/server/modules/pickup/use-cases';

const SESSION = {
  adminId: 'admin_1',
  adminRole: 'OPERATIONS_ADMIN',
};

const BOOKED_LEASE = {
  lease: {
    id: 'L1',
    status: 'BOOKED',
    leaseDate: '2026-08-10',
    startTime: '09:00',
    vehicle: { id: 'v1', model: 'Activa' },
    shift: { id: 's1', name: 'Morning' },
  },
  pricing: { tier: 'standard', discount: 0 },
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/rentals/book-on-behalf', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/rentals/book-on-behalf — P2.10', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(SESSION);
    m.hasPermission.mockReturnValue(true);
    m.findFirstRider.mockResolvedValue({ id: 'rider_db_1', lifecycleStatus: 'DEPOSIT_APPROVED' });
    m.bookRental.mockResolvedValue(BOOKED_LEASE);
    m.completePickupVerification.mockResolvedValue({ id: 'rider_db_1', lifecycleStatus: 'ACTIVE' });
    m.adminUnauthorized.mockReturnValue(new Response(null, { status: 401 }));
    m.adminForbidden.mockReturnValue(
      new Response(JSON.stringify({ success: false }), { status: 403 })
    );
  });

  it('401s without an admin session', async () => {
    m.requireAdmin.mockResolvedValue(null);
    const res = await POST(makeRequest({ riderId: 'rider_db_1', vehicleId: 'v1', shiftId: 's1', leaseDate: '2026-08-10', startTime: '09:00' }));
    expect(res.status).toBe(401);
    expect(m.bookRental).not.toHaveBeenCalled();
  });

  it('403s without the rentals_book permission', async () => {
    m.hasPermission.mockReturnValue(false);
    const res = await POST(makeRequest({ riderId: 'rider_db_1', vehicleId: 'v1', shiftId: 's1', leaseDate: '2026-08-10', startTime: '09:00' }));
    expect(res.status).toBe(403);
    expect(m.bookRental).not.toHaveBeenCalled();
  });

  it('422s on a malformed leaseDate', async () => {
    const res = await POST(makeRequest({ riderId: 'rider_db_1', vehicleId: 'v1', shiftId: 's1', leaseDate: '10/08/2026', startTime: '09:00' }));
    expect(res.status).toBe(422);
    expect(m.bookRental).not.toHaveBeenCalled();
  });

  it('422s on unknown fields (schema is .strict())', async () => {
    const res = await POST(makeRequest({ riderId: 'rider_db_1', vehicleId: 'v1', shiftId: 's1', leaseDate: '2026-08-10', startTime: '09:00', sneaky: 'x' }));
    expect(res.status).toBe(422);
    expect(m.bookRental).not.toHaveBeenCalled();
  });

  it('422s when required booking fields are missing', async () => {
    const res = await POST(makeRequest({ riderId: 'rider_db_1' }));
    expect(res.status).toBe(422);
    expect(m.bookRental).not.toHaveBeenCalled();
  });

  it('404s when the rider cannot be resolved', async () => {
    m.findFirstRider.mockResolvedValue(null);
    const res = await POST(makeRequest({ riderId: 'nope', vehicleId: 'v1', shiftId: 's1', leaseDate: '2026-08-10', startTime: '09:00' }));
    expect(res.status).toBe(404);
    expect(m.bookRental).not.toHaveBeenCalled();
  });

  it('404s when the rider is soft-deleted (data-deletion window)', async () => {
    // The route filters deletedAt: null, so a deleted rider resolves to null.
    m.findFirstRider.mockResolvedValue(null);
    const res = await POST(makeRequest({ riderId: 'deleted_rider', vehicleId: 'v1', shiftId: 's1', leaseDate: '2026-08-10', startTime: '09:00' }));
    expect(res.status).toBe(404);
    expect(m.findFirstRider).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    );
    expect(m.bookRental).not.toHaveBeenCalled();
  });

  it('409s when the rider is not in a bookable lifecycle state', async () => {
    m.findFirstRider.mockResolvedValue({ id: 'rider_db_1', lifecycleStatus: 'KYC_SUBMITTED' });
    const res = await POST(makeRequest({ riderId: 'rider_db_1', vehicleId: 'v1', shiftId: 's1', leaseDate: '2026-08-10', startTime: '09:00' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.message).toMatch(/PLAN_SELECTED or DEPOSIT_APPROVED/);
    expect(m.bookRental).not.toHaveBeenCalled();
  });

  it('books with the resolved db id and audits the acting admin', async () => {
    const res = await POST(makeRequest({ riderId: 'RID-PUBLIC-1', vehicleId: 'v1', shiftId: 's1', leaseDate: '2026-08-10', startTime: '09:00', reason: 'Locked out of app' }));
    expect(res.status).toBe(200);

    // Rider resolved by the OR lookup (public riderId → db id), soft-deleted
    // riders excluded.
    expect(m.findFirstRider).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ id: 'RID-PUBLIC-1' }, { riderId: 'RID-PUBLIC-1' }],
          deletedAt: null,
        },
      })
    );
    expect(m.bookRental).toHaveBeenCalledWith('rider_db_1', {
      vehicleId: 'v1',
      shiftId: 's1',
      leaseDate: '2026-08-10',
      startTime: '09:00',
    });

    // Audit: actor is the ADMIN, not the rider
    expect(m.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin_1',
        actorType: 'ADMIN',
        action: 'rental.book_on_behalf',
        entity: 'RentalLease',
        entityId: 'L1',
      })
    );

    expect(m.invalidateCache).toHaveBeenCalledWith('admin:rentals:*');
    expect(m.invalidateRiderCache).toHaveBeenCalledWith('rider_db_1');

    const body = await res.json();
    expect(body.data.lease.id).toBe('L1');
    expect(body.data.pickupCompleted).toBe(false);
    expect(body.data.rider).toBeNull();
  });

  it('skips pickup completion when completePickup is not set', async () => {
    const res = await POST(makeRequest({ riderId: 'rider_db_1', vehicleId: 'v1', shiftId: 's1', leaseDate: '2026-08-10', startTime: '09:00' }));
    expect(res.status).toBe(200);
    expect(m.completePickupVerification).not.toHaveBeenCalled();
  });

  it('chains pickup completion with verifiedBy = adminId when completePickup is true', async () => {
    const res = await POST(
      makeRequest({
        riderId: 'rider_db_1',
        vehicleId: 'v1',
        shiftId: 's1',
        leaseDate: '2026-08-10',
        startTime: '09:00',
        completePickup: true,
        hubId: 'h1',
        pickupPhotoFront: 'https://cdn/front.jpg',
        pickupPhotoBack: 'https://cdn/back.jpg',
      })
    );
    expect(res.status).toBe(200);
    expect(m.completePickupVerification).toHaveBeenCalledWith(
      'rider_db_1',
      expect.objectContaining({
        vehicleId: 'v1',
        hubId: 'h1',
        pickupPhotoFront: 'https://cdn/front.jpg',
        pickupPhotoBack: 'https://cdn/back.jpg',
        verifiedBy: 'admin_1',
      })
    );
    const body = await res.json();
    expect(body.data.pickupCompleted).toBe(true);
    expect(body.data.rider.lifecycleStatus).toBe('ACTIVE');
  });

  it('400s when pickup completion fails a precondition (photos required)', async () => {
    m.completePickupVerification.mockRejectedValue(
      new PickupVerificationError('At least 2 photos (front, back) are required', 'PHOTOS_REQUIRED')
    );
    const res = await POST(
      makeRequest({
        riderId: 'rider_db_1',
        vehicleId: 'v1',
        shiftId: 's1',
        leaseDate: '2026-08-10',
        startTime: '09:00',
        completePickup: true,
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/photos/i);
    // The booking already happened — it must still be audited + caches flushed
    expect(m.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'rental.book_on_behalf', entityId: 'L1' })
    );
    expect(m.invalidateRiderCache).toHaveBeenCalledWith('rider_db_1');
  });

  it('maps the vehicle-claim race to 409 instead of a generic 500', async () => {
    m.completePickupVerification.mockRejectedValue(
      new Error('Vehicle is currently reserved. It may have been claimed by another rider.')
    );
    const res = await POST(
      makeRequest({
        riderId: 'rider_db_1',
        vehicleId: 'v1',
        shiftId: 's1',
        leaseDate: '2026-08-10',
        startTime: '09:00',
        completePickup: true,
      })
    );
    expect(res.status).toBe(409);
  });

  it('409s when the shift is fully booked (RentalBookError CONFLICT)', async () => {
    m.bookRental.mockRejectedValue(
      new RentalBookError('This shift is fully booked (2/2 slots taken)', 'CONFLICT')
    );
    const res = await POST(makeRequest({ riderId: 'rider_db_1', vehicleId: 'v1', shiftId: 's1', leaseDate: '2026-08-10', startTime: '09:00' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.message).toMatch(/fully booked/i);
  });
});
