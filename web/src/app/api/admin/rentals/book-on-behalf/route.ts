/**
 * POST /api/admin/rentals/book-on-behalf — create a rental for a rider (P2.10)
 *
 * P2.10 (2026-08-05 rentals/vehicles/hubs audit): `bookRental` and
 * `syncPickup` were rider-side entry points only, so a locked-out rider
 * calling support could not be helped — the admin could only start/close an
 * existing lease via `executeLeaseAction`. This route mirrors the two rider
 * use cases behind the admin RBAC surface:
 *
 *   1. `rentalUseCases.bookRental` — availability check, dynamic pricing,
 *      lease create + vehicle RESERVED + rider → PICKUP_SCHEDULED.
 *   2. (optional) `completePickupVerification` when `completePickup: true` —
 *      syncPickup's photo-precondition wrapper: vehicle claim + lease
 *      activation + rider → ACTIVE. The admin acts as `verifiedBy` so the
 *      pickup.verification_completed audit entry records the admin, not the
 *      rider, as the actor.
 *
 * The acting admin is written to the audit log on every booking (action
 * `rental.book_on_behalf`, entity RentalLease). This is a privileged,
 * money-binding operation — gated by the `rentals_book` permission.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { invalidateCache } from '@/lib/cache';
import { invalidateRiderCache } from '@/lib/server-cache';
import { createAuditLog } from '@/lib/audit-log';
import { withApiHandler } from '@/lib/api-handler';
import { validateBody } from '@/lib/validators';
import { adminBookRentalOnBehalfSchema } from '@/lib/validators/admin';
import { rentalUseCases } from '@/server/modules/rentals/rental.use-cases';
import {
  completePickupVerification,
  PickupVerificationError,
} from '@/server/modules/pickup/use-cases';

export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'rentals_book')) {
    return adminForbidden('Insufficient permissions to book a rental on behalf of a rider');
  }

  const body = await request.json().catch(() => ({}));
  const validation = validateBody(adminBookRentalOnBehalfSchema, body);
  if (!validation.success) return errors.validation(validation.error);
  const data = validation.data;

  // Resolve the rider by public riderId OR internal db id — admins copy the
  // id from the admin UI (which surfaces the public riderId) but support
  // might also have the db id from a ticket. Same OR lookup as riders/[id].
  const rider = await db.rider.findFirst({
    where: {
      OR: [{ id: data.riderId }, { riderId: data.riderId }],
      // P2.10 hardening: never book a lease for a rider inside the
      // data-deletion window (wallet-adjust blocks these too).
      deletedAt: null,
    },
    select: { id: true, lifecycleStatus: true },
  });
  if (!rider) return errors.notFound('Rider not found');

  // P2.10 hardening: `bookRental` only transitions riders in PLAN_SELECTED /
  // DEPOSIT_APPROVED (its updateMany targets those states). The rider app
  // gates the lifecycle before booking, but an admin can pick ANY rider id —
  // booking for a rider in another state would silently create a BOOKED lease
  // + RESERVED vehicle while the rider never reaches PICKUP_SCHEDULED, and
  // the pickup chain would then fail with INVALID_STATE. Fail cleanly first.
  const BOOKABLE_LIFECYCLE = ['PLAN_SELECTED', 'DEPOSIT_APPROVED'] as const;
  if (!BOOKABLE_LIFECYCLE.includes(rider.lifecycleStatus as (typeof BOOKABLE_LIFECYCLE)[number])) {
    return errors.conflict(
      `Cannot book on behalf: rider lifecycleStatus is "${rider.lifecycleStatus}", expected PLAN_SELECTED or DEPOSIT_APPROVED`
    );
  }

  const riderDbId = rider.id;

  // ── 1. Book the rental (mirror of the rider bookRental route) ──────────
  const booked = await rentalUseCases.bookRental(riderDbId, {
    vehicleId: data.vehicleId,
    shiftId: data.shiftId,
    leaseDate: data.leaseDate,
    startTime: data.startTime,
  });

  // The booking changed the rider's lifecycle + assigned vehicle — the rider
  // cache (dashboard, profile) must reflect it immediately. This and the
  // audit log describe the booking, which has ALREADY happened, so they run
  // BEFORE the optional pickup attempt — a pickup failure (400) must never
  // leave a successful booking un-audited or a stale rider cache.
  invalidateRiderCache(riderDbId);
  await createAuditLog({
    actorId: session.adminId!,
    actorType: 'ADMIN',
    action: 'rental.book_on_behalf',
    entity: 'RentalLease',
    entityId: booked.lease.id,
    details: {
      riderId: riderDbId,
      vehicleId: data.vehicleId,
      shiftId: data.shiftId,
      leaseDate: data.leaseDate,
      startTime: data.startTime,
      completePickup: data.completePickup,
      reason: data.reason ?? null,
    },
  }).catch((err) => {
    // Non-blocking: `rental.book_on_behalf` is not in the critical-action
    // set, so a write failure is logged, not thrown.
    logger.warn('[book-on-behalf] audit log write failed (non-blocking)', { err });
  });

  // Invalidate the admin rental list cache (same namespace the GET handler
  // reads) so the new lease shows up without waiting for the 5s TTL.
  invalidateCache('admin:rentals:*');

  // ── 2. (optional) Complete the pickup so the rider becomes ACTIVE ───────
  let pickupResult: unknown = null;
  if (data.completePickup) {
    try {
      pickupResult = await completePickupVerification(riderDbId, {
        vehicleId: data.vehicleId,
        hubId: data.hubId,
        teamLeaderId: data.teamLeaderId,
        emergencyContact: data.emergencyContact,
        pickupPhotoFront: data.pickupPhotoFront,
        pickupPhotoBack: data.pickupPhotoBack,
        pickupPhotoLeft: data.pickupPhotoLeft,
        pickupPhotoRight: data.pickupPhotoRight,
        pickupPhotoWithVehicle: data.pickupPhotoWithVehicle,
        // The ADMIN is the verifiedBy — completePickupVerification writes the
        // pickup.verification_completed audit entry with actorType ADMIN.
        verifiedBy: session.adminId,
      });
    } catch (err) {
      // completePickupVerification's precondition errors (photos required,
      // wrong lifecycle state, rider not found) are client-correctable → 400.
      if (err instanceof PickupVerificationError) {
        return errors.badRequest(err.message);
      }
      // syncPickup's vehicle-claim race throws a plain Error ("Vehicle is
      // currently ...") — map to 409 like the rider pickup route instead of
      // leaking a generic 500. P1: generic message, no raw echo.
      if (err instanceof Error && err.message.includes('currently')) {
        return errors.conflict('Vehicle is currently unavailable');
      }
      throw err;
    }
  }

  logger.info('[POST /api/admin/rentals/book-on-behalf]', {
    adminId: session.adminId,
    riderDbId,
    leaseId: booked.lease.id,
    completePickup: data.completePickup,
  });

  return success(
    {
      lease: booked.lease,
      pricing: booked.pricing,
      rider: pickupResult ?? null,
      pickupCompleted: data.completePickup,
    },
    data.completePickup
      ? 'Rental booked and pickup completed on behalf of rider'
      : 'Rental booked on behalf of rider'
  );
});
