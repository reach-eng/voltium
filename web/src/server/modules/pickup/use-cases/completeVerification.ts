/**
 * completePickupVerification — pickup verification use case (PR-26b, API N3)
 *
 * Extracted from the rider `updateProfile` chokepoint. This use case owns
 * the cross-entity invariants around completing a vehicle pickup:
 *
 *   1. Rider must be in `lifecycleStatus === 'PICKUP_SCHEDULED'`.
 *   2. The caller must supply >= 2 photos (front, back) — the rider cannot
 *      activate an account without photographic verification of the
 *      handover.
 *   3. Hand off to `rentalUseCases.syncPickup`, which performs the
 *      vehicle claim + lease activation + rider transition to ACTIVE.
 *   4. Write a non-blocking audit log entry (`pickup.verification_completed`).
 *
 * The previous pickup route (POST /api/rider/sync/pickup) already routed to
 * `rentalUseCases.syncPickup` directly — this use case is a NEW
 * boundary that adds the precondition checks the audit requires. The
 * existing route is updated to call this use case instead of
 * `rentalUseCases.syncPickup` directly.
 *
 * IMPORTANT: This module is NEW. The existing `syncPickup` use case lives
 * in `web/src/server/modules/rentals/use-cases/sync-pickup.use-case.ts`
 * and is preserved as the underlying transaction wrapper. The two
 * responsibilities are split so that:
 *   - this file = "should we even attempt this?" (preconditions + audit)
 *   - syncPickup = "atomically claim vehicle + transition state" (DB work)
 */

import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { invalidateRiderCache } from '@/lib/server-cache';
import { rentalUseCases } from '@/server/modules/rentals/rental.use-cases';
import { PickupVerificationError } from './errors';

const MIN_PHOTOS = 2;

export interface CompletePickupVerificationInput {
  vehicleId: string;
  hubId?: string;
  teamLeader?: string;
  emergencyContact?: string;
  pickupPhotoFront?: string;
  pickupPhotoBack?: string;
  pickupPhotoLeft?: string;
  pickupPhotoRight?: string;
  pickupPhotoWithVehicle?: string;
  verifiedBy?: string; // Free-form: team-leader name or admin id (audited)
}

/**
 * Complete pickup verification for a rider.
 *
 * @param riderDbId Rider's internal database id (from session).
 * @param input Pickup fields (vehicleId + at least 2 photos).
 * @returns The updated rider (flattened + URL-signed) from syncPickup.
 *
 * @throws PickupVerificationError on any precondition failure.
 */
export async function completePickupVerification(
  riderDbId: string,
  input: CompletePickupVerificationInput
): Promise<unknown> {
  // ── Precondition 1: photo count ─────────────────────────────────────
  const photoCount = [input.pickupPhotoFront, input.pickupPhotoBack].filter(
    (u): u is string => typeof u === 'string' && u.length > 0
  ).length;
  if (photoCount < MIN_PHOTOS) {
    throw new PickupVerificationError(
      `At least ${MIN_PHOTOS} photos (front, back) are required to complete pickup verification (got ${photoCount}).`,
      'PHOTOS_REQUIRED'
    );
  }

  // ── Precondition 2: rider exists + is in PICKUP_SCHEDULED state ──────
  const rider = await db.rider.findUnique({
    where: { id: riderDbId },
    select: { id: true, riderId: true, lifecycleStatus: true },
  });
  if (!rider) {
    throw new PickupVerificationError('Rider not found', 'RIDER_NOT_FOUND');
  }

  if (rider.lifecycleStatus !== 'PICKUP_SCHEDULED') {
    throw new PickupVerificationError(
      `Cannot complete pickup verification: rider lifecycleStatus is "${rider.lifecycleStatus}", expected "PICKUP_SCHEDULED".`,
      'INVALID_STATE'
    );
  }

  // ── Delegate to the existing syncPickup use case for the actual DB work ──
  // syncPickup owns: vehicle claim (race-safe) + lease activation + rider
  // transition to ACTIVE. The route used to call it directly without any
  // precondition checks; now those checks live here.
  const result = await rentalUseCases.syncPickup(riderDbId, {
    vehicleId: input.vehicleId,
    hubId: input.hubId,
    teamLeader: input.teamLeader,
    emergencyContact: input.emergencyContact,
    pickupPhotoFront: input.pickupPhotoFront,
    pickupPhotoBack: input.pickupPhotoBack,
    pickupPhotoLeft: input.pickupPhotoLeft,
    pickupPhotoRight: input.pickupPhotoRight,
    pickupPhotoWithVehicle: input.pickupPhotoWithVehicle,
  });

  invalidateRiderCache(riderDbId);

  // ── Audit log ───────────────────────────────────────────────────────
  await createAuditLog({
    actorId: input.verifiedBy || riderDbId,
    actorType: input.verifiedBy ? 'ADMIN' : 'RIDER',
    action: 'pickup.verification_completed',
    entity: 'Rider',
    entityId: riderDbId,
    details: {
      vehicleId: input.vehicleId,
      hubId: input.hubId,
      teamLeader: input.teamLeader,
      photoCount,
    },
  }).catch((err) => {
    logger.warn('[completePickupVerification] audit log write failed (non-blocking)', { err });
  });

  return result;
}
