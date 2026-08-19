/**
 * submitReturn — vehicle-return use case (PR-26b, API N3)
 *
 * Extracted from the `riderUseCases.updateProfile` chokepoint. This use case
 * owns the cross-entity invariants around ending an active rental:
 *
 *   1. Rider must be in `lifecycleStatus === 'ACTIVE'` (the audit calls this
 *      `RENTAL_ACTIVE` — the model is one status on the Rider row, not a
 *      separate state machine flag).
 *   2. The rider must have a vehicle assigned (`vehicleId`).
 *   3. The caller must supply >= 4 photos (front, back, left, right) — the
 *      vehicle return cannot be processed without photographic evidence.
 *   4. Atomically: create the `VehicleReturn` row + transition the rider to
 *      `RETURN_PENDING`. Either both happen or neither.
 *   5. Write a non-blocking audit log entry (`rental.return_submitted`).
 *
 * The PR-26b spec defines this as a thin use case; the existing
 * `rentalRepository.endRental` handles the lifecycle transition validation,
 * but does NOT create the VehicleReturn row. This file is the missing glue.
 *
 * If a caller tries to skip this use case and write `returnPending: true` via
 * `riderUseCases.updateProfile`, the existing chokepoint code still works
 * but bypasses the new invariants. PR-26b removes the rental-return branch
 * from the chokepoint.
 */

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { invalidateRiderCache } from '@/lib/server-cache';
import { OutboxService, OutboxEventTypes } from '@/server/workers/outbox';
import { RentalReturnError } from './errors';

const MIN_PHOTOS = 4;

export interface SubmitReturnInput {
  photoUrls: string[]; // [photoLeft, photoRight, photoFront, photoSpeedometer]
  reason?: string;
  latitude?: number;
  longitude?: number;
}

export interface SubmitReturnResult {
  returnId: string;
  vehicleId: string;
  rentalStatus: 'RETURN_PENDING';
}

/**
 * Submit a vehicle return for an active rental.
 *
 * @param riderDbId Rider's internal database id (from session).
 * @param input Photos + optional reason / location.
 * @returns The created VehicleReturn summary and the new rental status.
 *
 * @throws RentalReturnError on any precondition failure (caller-friendly codes).
 */
export async function submitReturn(
  riderDbId: string,
  input: SubmitReturnInput
): Promise<SubmitReturnResult> {
  // ── Precondition 1: photos count ─────────────────────────────────────
  const photos = input.photoUrls?.filter((u): u is string => typeof u === 'string' && u.length > 0) ?? [];
  if (photos.length < MIN_PHOTOS) {
    throw new RentalReturnError(
      `At least ${MIN_PHOTOS} photos are required to submit a return (got ${photos.length}).`,
      'PHOTOS_REQUIRED'
    );
  }

  // ── Precondition 2: rider exists + is in ACTIVE state + has vehicle ──
  const rider = await db.rider.findUnique({
    where: { id: riderDbId },
    select: {
      id: true,
      riderId: true,
      lifecycleStatus: true,
      vehicleId: true,
      assignedVehicle: true,
    },
  });
  if (!rider) {
    throw new RentalReturnError('Rider not found', 'RIDER_NOT_FOUND');
  }

  if (rider.lifecycleStatus !== 'ACTIVE') {
    throw new RentalReturnError(
      `Cannot submit return: rider lifecycleStatus is "${rider.lifecycleStatus}", expected "ACTIVE".`,
      'INVALID_STATE'
    );
  }

  // Resolve vehicle id — same logic as the legacy chokepoint path so the
  // PR-26b migration is a behaviour-preserving extraction.
  let vehicleId = rider.vehicleId;
  if (!vehicleId && rider.assignedVehicle) {
    const vehicle = await db.vehicle.findFirst({
      where: {
        OR: [
          { vehicleId: rider.assignedVehicle },
          { vehicleNumber: rider.assignedVehicle },
        ],
      },
      select: { id: true },
    });
    vehicleId = vehicle?.id ?? null;
  }
  if (!vehicleId) {
    throw new RentalReturnError(
      'No vehicle assigned to this rider — cannot submit a return.',
      'NO_VEHICLE'
    );
  }

  // ── Atomic: create VehicleReturn row + transition rider to RETURN_PENDING ──
  const result = await db.$transaction(async (tx) => {
    const vehicleReturn = await tx.vehicleReturn.create({
      data: {
        riderId: riderDbId,
        vehicleId,
        status: 'SUBMITTED',
        photoLeft: photos[0] ?? null,
        photoRight: photos[1] ?? null,
        photoFront: photos[2] ?? null,
        photoSpeedometer: photos[3] ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        reason: input.reason ?? 'End of rental',
      },
      select: { id: true },
    });

    const updateResult = await tx.rider.updateMany({
      where: { id: riderDbId, lifecycleStatus: 'ACTIVE' },
      data: { lifecycleStatus: 'RETURN_PENDING' },
    });
    if (updateResult.count === 0) {
      // Race: rider moved out of ACTIVE between the read and the update.
      throw new RentalReturnError(
        'Rider state changed concurrently — return not submitted. Please retry.',
        'RACE_CONDITION'
      );
    }

    return { returnId: vehicleReturn.id, vehicleId };
  });

  invalidateRiderCache(riderDbId);

  // ── Outbox Event & Audit log ──
  await OutboxService.emit(OutboxEventTypes.RENT_PAID, {
    riderId: riderDbId,
    leaseId: result.returnId,
    amountInPaise: 0,
    periodNo: 1,
  }).catch((err) => {
    logger.warn('[submitReturn] RENT_PAID outbox emit failed (non-blocking)', { err });
  });

  await createAuditLog({
    actorId: riderDbId,
    actorType: 'RIDER',
    action: 'rental.return_submitted',
    entity: 'VehicleReturn',
    entityId: result.returnId,
    details: {
      vehicleId: result.vehicleId,
      photoCount: photos.length,
      reason: input.reason ?? 'End of rental',
    },
  }).catch((err) => {
    logger.warn('[submitReturn] audit log write failed (non-blocking)', { err });
  });

  return {
    returnId: result.returnId,
    vehicleId: result.vehicleId,
    rentalStatus: 'RETURN_PENDING',
  };
}
