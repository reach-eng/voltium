/**
 * Rentals module - Repository.
 *
 * Data access for rental plans, bookings, active rentals, and return records.
 * All rental status transitions are validated against the rental state machine.
 *
 * Note: The Rider model stores rental state directly. Return photos/reason
 * are stored in the VehicleReturn model (not Rider).
 */

import { db } from '@/lib/db';
import { validateRentalTransition, RentalStateError } from './rental-state-machine';
import type { RentalStatus } from './rental.types';
import { validateTransition as validateRiderTransition, type RiderLifecycleStatus } from '@/server/modules/riders/rider-lifecycle.service';
import { getDurationForPlanType } from '@/server/modules/plans/plan.use-cases';
import { Prisma } from '@prisma/client';
import { getCachedRider, getCachedRiderStatus, invalidateRiderCache, invalidateVehicleCache, CACHE_TTLS } from '@/lib/server-cache';
import { invalidateCache } from '@/lib/cache';

/**
 * P1.3 (2026-08-05 rentals/vehicles/hubs audit): lease time writes used
 * `new Date().toTimeString().slice(0, 5)` — the SERVER's local timezone.
 * Times are stored as HH:MM strings until the String→DateTime migration, so
 * all writes must use UTC to be timezone-consistent for every rider.
 */
export function utcNowHHMM(): string {
  return new Date().toISOString().slice(11, 16);
}

export const rentalRepository = {
  // P1.9: deleted plans must never surface in rider/admin plan lists.
  async findPlans() {
    return db.rentalPlan.findMany({ where: { isActive: true, deletedAt: null } });
  },

  // P1.9: a soft-deleted plan must not be assignable.
  async findPlanById(planId: string) {
    return db.rentalPlan.findUnique({ where: { id: planId, deletedAt: null } });
  },

  async findActiveRental(riderDbId: string) {
    return getCachedRiderStatus(
      riderDbId,
      () =>
        db.rider.findUnique({
          where: { id: riderDbId },
          select: {
            id: true,
            lifecycleStatus: true,
            currentPlan: true,
            assignedVehicle: true,
            pickupHub: true,
            planStartDate: true,
            planEndDate: true,
          },
        }),
      CACHE_TTLS.rider,
      'wide'
    );
  },

  async selectPlan(riderDbId: string, planId: string) {
    const rider = await getCachedRiderStatus(riderDbId, () =>
      db.rider.findUnique({
        where: { id: riderDbId },
        select: { lifecycleStatus: true },
      })
    );

    const currentStatus: RentalStatus =
      (rider?.lifecycleStatus as unknown as RentalStatus) || 'NO_RENTAL';
    validateRentalTransition(currentStatus, 'PLAN_SELECTED');

    const result = await db.rider.updateMany({
      where: { id: riderDbId, lifecycleStatus: rider?.lifecycleStatus },
      data: {
        currentPlan: planId,
        lifecycleStatus: 'PLAN_SELECTED',
      },
    });

    if (result.count === 0) {
      throw new RentalStateError(
        `Rental state transition race condition for rider ${riderDbId}`,
        currentStatus,
        'PLAN_SELECTED'
      );
    }

    invalidateRiderCache(riderDbId);
    return getCachedRider(riderDbId, () => db.rider.findUnique({ where: { id: riderDbId } }));
  },

  async startRental(riderDbId: string, vehicleId: string, hubId: string, teamLeaderId: string) {
    const rider = await getCachedRiderStatus(riderDbId, () =>
      db.rider.findUnique({
        where: { id: riderDbId },
        select: { lifecycleStatus: true, currentPlan: true, currentPlanId: true },
      })
    );

    const currentStatus: RentalStatus =
      (rider?.lifecycleStatus as unknown as RentalStatus) || 'NO_RENTAL';
    validateRentalTransition(currentStatus, 'ACTIVE');

    // P1.2: `pickupHub` must be the human-readable hub NAME, not the raw
    // caller argument (which is a cuid from some callers and a name from
    // others). Resolve a cuid to its name; a name passes through unchanged.
    const hubName = hubId
      ? (await db.hub.findUnique({ where: { id: hubId }, select: { name: true } }))?.name
      : undefined;

    // F-05: Plan window starts at activation, not selection.
    let durationDays = 7;
    if (rider?.currentPlanId && db.rentalPlan?.findUnique) {
      const plan = await db.rentalPlan.findUnique({ where: { id: rider.currentPlanId } });
      if (plan) durationDays = getDurationForPlanType(plan.type);
    } else if (rider?.currentPlan && db.rentalPlan?.findFirst) {
      const plan = await db.rentalPlan.findFirst({ where: { name: rider.currentPlan, deletedAt: null } });
      if (plan) durationDays = getDurationForPlanType(plan.type);
    }
    const now = new Date();
    const planEndDate = new Date(now.getTime() + durationDays * 86400000);

    const result = await db.rider.updateMany({
      where: { id: riderDbId, lifecycleStatus: rider?.lifecycleStatus },
      data: {
        lifecycleStatus: 'ACTIVE',
        vehicleId,
        pickupHub: hubName || hubId,
        teamLeaderId,
        planStartDate: now,
        planEndDate: planEndDate,
      },
    });

    if (result.count === 0) {
      throw new RentalStateError(
        `Rental state transition race condition for rider ${riderDbId}`,
        currentStatus,
        'ACTIVE'
      );
    }

    invalidateRiderCache(riderDbId);
    invalidateVehicleCache(vehicleId);
    return getCachedRider(riderDbId, () => db.rider.findUnique({ where: { id: riderDbId } }));
  },

  async endRental(riderDbId: string) {
    const rider = await getCachedRiderStatus(riderDbId, () =>
      db.rider.findUnique({
        where: { id: riderDbId },
        select: { lifecycleStatus: true },
      })
    );

    const currentStatus: RentalStatus =
      (rider?.lifecycleStatus as unknown as RentalStatus) || 'NO_RENTAL';
    validateRentalTransition(currentStatus, 'RETURN_PENDING');

    const result = await db.rider.updateMany({
      where: { id: riderDbId, lifecycleStatus: rider?.lifecycleStatus },
      data: {
        lifecycleStatus: 'RETURN_PENDING',
      },
    });

    if (result.count === 0) {
      throw new RentalStateError(
        `Rental state transition race condition for rider ${riderDbId}`,
        currentStatus,
        'RETURN_PENDING'
      );
    }

    invalidateRiderCache(riderDbId);
    return getCachedRider(riderDbId, () => db.rider.findUnique({ where: { id: riderDbId } }));
  },

  // P3.10: typed args — the route can no longer pass invalid where fields.
  async findManyLeases(args: Prisma.RentalLeaseFindManyArgs) {
    return db.rentalLease.findMany(args);
  },

  async countLeases(args: Prisma.RentalLeaseCountArgs) {
    return db.rentalLease.count(args);
  },

  async findLeaseById(id: string) {
    const direct = await db.rentalLease.findUnique({
      where: { id },
      include: { rider: true, vehicle: true },
    });
    if (direct) return direct;

    return db.rentalLease.findFirst({
      where: {
        riderId: id,
        status: { in: ['BOOKED', 'PICKUP_SCHEDULED', 'ACTIVE', 'RETURN_PENDING', 'OVERDUE'] },
      },
      include: { rider: true, vehicle: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * P1.1 (2026-08-05 rentals/vehicles/hubs audit — audit demotion REJECTED):
   * the old code validated against `lease.rider.lifecycleStatus` — the
   * PRE-transaction snapshot — then wrote with unconditional `tx.rider.update`
   * / `tx.rentalLease.update`. Two concurrent admin actions (START + SUSPEND)
   * both validated against the same snapshot and both wrote: last-write-wins
   * with no validation against the final state. The audit demoted this because
   * selectPlan/startRental/endRental use the optimistic-lock updateMany
   * pattern — but executeLeaseAction (the ADMIN route path) did not.
   *
   * Fix: re-read the rider's status inside the tx, validate against THAT, and
   * guard every rider/lease write with status-guarded updateMany + count
   * checks. A concurrent action that already moved the row throws
   * RentalStateError (409) instead of silently overwriting it.
   */
  async executeLeaseAction(
    lease: Prisma.RentalLeaseGetPayload<{ include: { rider: true; vehicle: true } }>,
    action: string
  ) {
    const result = await db.$transaction(async (tx) => {
      const freshRider = await tx.rider.findUnique({
        where: { id: lease.riderId },
        select: { lifecycleStatus: true },
      });
      const currentStatus: RentalStatus =
        (freshRider?.lifecycleStatus as unknown as RentalStatus) || 'NO_RENTAL';

      // Guarded state transition: validates against the fresh status, then
      // writes both the rider and the lease with the old status in the WHERE
      // clause. count === 0 means another transaction already moved the row.
      const apply = async (
        target: string,
        riderData: Record<string, unknown> = {},
        leaseData: Record<string, unknown> = {}
      ) => {
        validateRiderTransition(
          currentStatus as unknown as RiderLifecycleStatus,
          target as unknown as RiderLifecycleStatus
        );
        const riderRes = await tx.rider.updateMany({
          where: {
            id: lease.riderId,
            lifecycleStatus: currentStatus as unknown as RiderLifecycleStatus,
          },
          data: {
            lifecycleStatus: target as unknown as RiderLifecycleStatus,
            ...riderData,
          },
        });
        if (riderRes.count === 0) {
          throw new RentalStateError(
            `Rental state transition race for rider ${lease.riderId}: ${currentStatus} → ${target}`,
            currentStatus,
            target as unknown as RentalStatus
          );
        }
        const leaseRes = await tx.rentalLease.updateMany({
          where: { id: lease.id, status: lease.status },
          data: { status: target as unknown as RentalStatus, ...leaseData },
        });
        if (leaseRes.count === 0) {
          throw new RentalStateError(
            `Rental lease transition race for lease ${lease.id}: ${lease.status} → ${target}`,
            currentStatus,
            target as unknown as RentalStatus
          );
        }
        return tx.rentalLease.findUnique({ where: { id: lease.id } });
      };

      if (action === 'START' || action === 'PICKUP_COMPLETE') {
        await tx.vehicle.update({
          where: { id: lease.vehicleId },
          data: { status: 'ACTIVE_RENTAL', assignedAt: new Date() },
        });
        return apply('ACTIVE', {
          vehicleId: lease.vehicleId,
          assignedVehicle: lease.vehicle.vehicleNumber,
          pickedUpAt: new Date(),
        });
      }
      if (action === 'MARK_OVERDUE') {
        // Lease-only action — the rider lifecycle is untouched.
        const leaseRes = await tx.rentalLease.updateMany({
          where: { id: lease.id, status: lease.status },
          data: { status: 'OVERDUE' },
        });
        if (leaseRes.count === 0) {
          throw new RentalStateError(
            `Rental lease transition race for lease ${lease.id}: ${lease.status} → OVERDUE`,
            currentStatus,
            'OVERDUE'
          );
        }
        return tx.rentalLease.findUnique({ where: { id: lease.id } });
      }
      if (action === 'REQUEST_RETURN') {
        await tx.vehicle.update({
          where: { id: lease.vehicleId },
          data: { status: 'RETURN_PENDING' },
        });
        return apply('RETURN_PENDING');
      }
      if (action === 'APPROVE_RETURN' || action === 'CLOSE') {
        await tx.vehicle.update({
          where: { id: lease.vehicleId },
          data: { status: 'AVAILABLE', assignedAt: null },
        });
        // P1.3: endTime must be UTC (toISOString), not server-local time.
        return apply('CLOSED', { vehicleId: null, assignedVehicle: null }, { endTime: utcNowHHMM() });
      }
      if (action === 'SUSPEND') {
        return apply('SUSPENDED');
      }
      throw new Error(`Unsupported rental action: ${action}`);
    });

    // Invalidate rider + vehicle entity caches after any rental action that
    // touches either entity (all actions above except MARK_OVERDUE do).
    invalidateRiderCache(lease.riderId);
    invalidateVehicleCache(lease.vehicleId);
    // P2.4: the tx used tx.vehicle.update directly, bypassing
    // vehicleRepository.update's cache invalidation — the admin vehicle LIST
    // caches stayed stale for up to their TTL. Clear them here.
    invalidateCache('vehicles_list:*');
    invalidateCache('admin:vehicles:*');
    return result;
  },
};
