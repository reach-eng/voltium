/**
 * Rentals module - Use cases.
 *
 * Orchestrates plan selection, booking, pickup, active rental, and return workflows.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { calculateDynamicPrice } from '@/lib/dynamic-pricing';
import { flattenRider } from '@/lib/flatten-rider';
import { signRiderUrls } from '@/lib/sign-rider';
import { rentalRepository, utcNowHHMM } from './rental.repository';
import { RentalBookError } from './use-cases/errors';
import { getDurationForPlanType } from '@/server/modules/plans/plan.use-cases';

/**
 * Ensures that a RentalLease row exists with status 'ACTIVE' for the given rider and vehicle.
 *
 * 1. Attempts to update any pre-existing lease in BOOKED or PICKUP_SCHEDULED to ACTIVE.
 * 2. If 0 rows updated, checks if an ACTIVE lease already exists for this rider and vehicle (idempotent re-pickup).
 * 3. If no ACTIVE lease exists (active onboarding path where bookRental was bypassed),
 *    creates a new RentalLease with status 'ACTIVE', resolved active shift, plan pricing,
 *    and period tracking (nextRentDueAt computed based on plan duration and advanceRentPaid).
 */
export async function ensureActiveRentalLease(
  tx: any,
  rider: any,
  vehicleId: string,
  options?: { shiftId?: string; startTime?: string }
): Promise<any> {
  const riderDbId = rider.id;
  const nowHHMM = options?.startTime ?? utcNowHHMM();
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Attempt to update pre-existing lease from bookRental
  const leaseUpdateResult = await tx.rentalLease.updateMany({
    where: {
      riderId: riderDbId,
      vehicleId,
      status: { in: ['BOOKED', 'PICKUP_SCHEDULED'] as const },
    },
    data: { status: 'ACTIVE', startTime: nowHHMM },
  });

  if (leaseUpdateResult.count > 0) {
    return leaseUpdateResult;
  }

  // 2. Check if an ACTIVE lease already exists (re-pickup / idempotent retry)
  if (typeof tx.rentalLease.findFirst === 'function') {
    const existingActiveLease = await tx.rentalLease.findFirst({
      where: {
        riderId: riderDbId,
        vehicleId,
        status: 'ACTIVE',
      },
    });
    if (existingActiveLease) {
      return existingActiveLease;
    }
  }

  // 3. Active onboarding path: resolve shift without collision on (vehicleId, shiftId, leaseDate)
  let shiftId = options?.shiftId;
  if (!shiftId && tx.shift) {
    const activeShifts = typeof tx.shift.findMany === 'function'
      ? await tx.shift.findMany({
          where: { isActive: true },
          orderBy: { startTime: 'asc' },
        })
      : [];

    const takenLeasesToday = typeof tx.rentalLease.findMany === 'function'
      ? await tx.rentalLease.findMany({
          where: { vehicleId, leaseDate: todayStr },
          select: { shiftId: true },
        })
      : [];
    const takenShiftIds = new Set(takenLeasesToday.map((l: { shiftId: string }) => l.shiftId));
    const availableShifts = activeShifts.filter((s: { id: string }) => !takenShiftIds.has(s.id));

    const matchingShift = availableShifts.find((s: { startTime: string; endTime: string }) => {
      if (s.startTime <= s.endTime) {
        return nowHHMM >= s.startTime && nowHHMM < s.endTime;
      } else {
        return nowHHMM >= s.startTime || nowHHMM < s.endTime;
      }
    });

    if (matchingShift) {
      shiftId = matchingShift.id;
    } else if (availableShifts.length > 0) {
      shiftId = availableShifts[0].id;
    } else if (activeShifts.length > 0) {
      shiftId = activeShifts[0].id;
    } else if (typeof tx.shift.findFirst === 'function') {
      const anyShift = await tx.shift.findFirst();
      if (anyShift) {
        shiftId = anyShift.id;
      } else if (typeof tx.shift.create === 'function') {
        const defaultShift = await tx.shift.create({
          data: {
            name: 'Default Shift',
            startTime: '00:00',
            endTime: '23:59',
            isActive: true,
          },
        });
        shiftId = defaultShift.id;
      }
    }
  }

  // Fetch plan reference if not loaded on rider
  let planRef = rider.currentPlanRef;
  if (!planRef && rider.currentPlanId && tx.rentalPlan && typeof tx.rentalPlan.findUnique === 'function') {
    planRef = await tx.rentalPlan.findUnique({ where: { id: rider.currentPlanId } });
  }

  // Calculate pricing and period tracking.
  // P1: ALWAYS derive from plan type (DAILY=1/WEEKLY=7/MONTHLY=30) — never
  // trust the stored `durationDays` column (pre-CHECK legacy rows can hold a
  // mismatched value and would bill the wrong period).
  const planPrice = rider.currentPlanPrice ?? planRef?.priceInPaise ?? 50000;
  const durationDays = planRef?.type ? getDurationForPlanType(planRef.type) : 1;

  const now = new Date();
  const isAdvancePaid = Boolean(rider.advanceRentPaid);
  const nextDue = isAdvancePaid
    ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
    : now;

  try {
    return await tx.rentalLease.create({
      data: {
        vehicleId,
        riderId: riderDbId,
        shiftId: shiftId || 'default-shift',
        leaseDate: todayStr,
        startTime: nowHHMM,
        status: 'ACTIVE',
        basePriceInPaise: planPrice,
        finalPriceInPaise: planPrice,
        periodNo: isAdvancePaid ? 1 : 0,
        lastPaidAt: isAdvancePaid ? now : null,
        nextRentDueAt: nextDue,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002' && tx.shift && typeof tx.shift.create === 'function') {
      const dynamicShift = await tx.shift.create({
        data: {
          name: `Shift-${Date.now()}`,
          startTime: nowHHMM,
          endTime: nowHHMM,
          isActive: true,
        },
      });
      return await tx.rentalLease.create({
        data: {
          vehicleId,
          riderId: riderDbId,
          shiftId: dynamicShift.id,
          leaseDate: todayStr,
          startTime: nowHHMM,
          status: 'ACTIVE',
          basePriceInPaise: planPrice,
          finalPriceInPaise: planPrice,
          periodNo: isAdvancePaid ? 1 : 0,
          lastPaidAt: isAdvancePaid ? now : null,
          nextRentDueAt: nextDue,
        },
      });
    }
    throw err;
  }
}

export const rentalUseCases = {
  async getPlans() {
    return rentalRepository.findPlans();
  },

  async selectPlan(riderDbId: string, planId: string) {
    return rentalRepository.selectPlan(riderDbId, planId);
  },

  /**
   * Books a vehicle rental with availability check, dynamic pricing, and state transitions.
   */
  async bookRental(
    riderDbId: string,
    input: {
      vehicleId: string;
      shiftId: string;
      leaseDate: string;
      startTime: string;
    }
  ) {
    const { vehicleId, shiftId, leaseDate, startTime } = input;

    // Check vehicle exists and is AVAILABLE
    const vehicle = await db.vehicle.findUnique({
      where: { id: vehicleId },
      include: { hub: { select: { id: true, name: true } } },
    });
    if (!vehicle) throw new RentalBookError('Vehicle not found', 'NOT_FOUND');
    if (vehicle.status !== 'AVAILABLE') {
      throw new RentalBookError(
        `Vehicle is not available for booking (current status: ${vehicle.status})`,
        'CONFLICT'
      );
    }

    // Check shift exists and is active
    const shift = await db.shift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new RentalBookError('Shift not found', 'NOT_FOUND');
    if (!shift.isActive)
      throw new RentalBookError('This shift is not currently active', 'VALIDATION');

    // Calculate dynamic pricing
    const [totalVehicles, availableVehicles, dailyRentSetting] = await Promise.all([
      db.vehicle.count({ where: { hubId: vehicle.hubId } }),
      db.vehicle.count({ where: { hubId: vehicle.hubId, status: 'AVAILABLE' } }),
      db.systemSetting.findUnique({ where: { key: 'dailyRent' } }),
    ]);
    const availabilityRatio = totalVehicles > 0 ? availableVehicles / totalVehicles : 0;
    const basePricePaise = dailyRentSetting ? parseInt(dailyRentSetting.value) || 18000 : 18000;

    const dynamicPrice = calculateDynamicPrice(basePricePaise, {
      hubId: vehicle.hub.id,
      hubName: vehicle.hub.name,
      totalVehicles,
      availableVehicles,
      availabilityRatio,
    });

    // Create RentalLease + update vehicle status atomically with race-condition guards
    const lease = await db.$transaction(async (tx) => {
      // Double-booking check inside the transaction
      const currentBookings = await tx.rentalLease.count({
        where: {
          vehicleId,
          shiftId,
          leaseDate,
          status: { in: ['BOOKED', 'ACTIVE'] },
        },
      });
      if (currentBookings >= shift.maxBookings) {
        throw new RentalBookError(
          `This shift is fully booked (${currentBookings}/${shift.maxBookings} slots taken). Please choose a different shift or date.`,
          'CONFLICT'
        );
      }

      // Check rider doesn't already have a lease for same shift/date
      const riderExistingLease = await tx.rentalLease.findFirst({
        where: {
          riderId: riderDbId,
          shiftId,
          leaseDate,
          status: { in: ['BOOKED', 'ACTIVE'] },
        },
      });
      if (riderExistingLease) {
        throw new RentalBookError(
          'You already have an active booking for this shift on this date',
          'CONFLICT'
        );
      }

      let newLease;
      try {
        newLease = await tx.rentalLease.create({
          data: {
            vehicleId,
            riderId: riderDbId,
            shiftId,
            leaseDate,
            startTime,
            basePriceInPaise: dynamicPrice.basePrice,
            finalPriceInPaise: dynamicPrice.finalPrice,
            status: 'BOOKED',
            // PR-76: period tracking. The first period is due at
            // start of the lease + durationDays. We set nextRentDueAt
            // to NOW so the rent-reminders job picks it up on its next
            // tick. Period 0 = first period. The job advances
            // periodNo and bumps nextRentDueAt by durationDays on
            // each successful auto-debit.
            periodNo: 0,
            nextRentDueAt: new Date(),
          },
          include: {
            vehicle: { select: { id: true, vehicleId: true, model: true } },
            shift: { select: { id: true, name: true, startTime: true, endTime: true } },
          },
        });
      } catch (err) {
        // P3.9: the count-based double-booking check is non-atomic — the
        // `@@unique([vehicleId, shiftId, leaseDate])` constraint is the real
        // guard. Convert P2002 into a clean RentalBookError instead of a 500.
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          throw new RentalBookError(
            'This vehicle is already booked for this shift on this date',
            'CONFLICT'
          );
        }
        throw err;
      }

      // PR-ONBOARDING-2026-08-11 (audit 2.11 R3): use updateMany with
      // a status guard so a vehicle that was set to MAINTENANCE between
      // the pre-check and the update is not silently clobbered to
      // RESERVED. Mirrors the rental.repository.executeLeaseAction
      // pattern.
      const vehicleClaim = await tx.vehicle.updateMany({
        where: { id: vehicleId, status: 'AVAILABLE' },
        data: { status: 'RESERVED' },
      });
      if (vehicleClaim.count === 0) {
        throw new RentalBookError(
          'Vehicle is no longer available',
          'NO_VEHICLE'
        );
      }

      // PR-ONBOARDING-2026-08-11 (audit 2.11 R4): the previous
      // updateMany had no count check, so a race where the rider was
      // concurrently SUSPENDED would still create the lease + flip the
      // vehicle, leaving the rider stuck. The count check now matches
      // the rest of the state-machine writers.
      const riderClaim = await tx.rider.updateMany({
        where: { id: riderDbId, lifecycleStatus: { in: ['PLAN_SELECTED', 'DEPOSIT_APPROVED'] } },
        data: {
          lifecycleStatus: 'PICKUP_SCHEDULED',
          vehicleId,
          assignedVehicle: vehicle.vehicleNumber,
          // P1.2: `pickupHub` must be the hub NAME (vehicle.hub.name), not a
          // cuid and not stale from a previous booking. syncPickup already
          // resolves the name — bookRental now agrees with it.
          pickupHub: vehicle.hub.name,
        },
      });
      if (riderClaim.count === 0) {
        throw new RentalBookError(
          'Rider is not in a bookable state',
          'INVALID_STATE'
        );
      }

      return newLease;
    });

    return {
      lease: {
        id: lease.id,
        status: lease.status,
        leaseDate: lease.leaseDate,
        startTime: lease.startTime,
        // PR-ONBOARDING-2026-08-11 (audit 2.12): the dynamic-pricing
        // layer works in paise, but the wire response was leaking paise
        // to the rider. Other endpoints in the rentals/plans/deposits
        // modules return rupees. Convert at the route boundary so the
        // rider client has one consistent unit.
        basePrice: lease.basePriceInPaise / 100,
        finalPrice: lease.finalPriceInPaise / 100,
        vehicle: lease.vehicle,
        shift: lease.shift,
      },
      pricing: {
        tier: dynamicPrice.tier,
        discount: dynamicPrice.discount,
        discountLabel: dynamicPrice.discountLabel,
        hubAvailability: dynamicPrice.availability,
      },
    };
  },

  async startRental(riderDbId: string, vehicleId: string, hubId: string, teamLeaderId: string) {
    return rentalRepository.startRental(riderDbId, vehicleId, hubId, teamLeaderId);
  },

  async getActiveRental(riderDbId: string) {
    return rentalRepository.findActiveRental(riderDbId);
  },

  /**
   * Processes a vehicle pickup — assigns vehicle, updates rider state, activates account.
   */
  async syncPickup(
    riderDbId: string,
    input: {
      vehicleId: string;
      hubId?: string;
      teamLeaderId?: string;
      emergencyContact?: string;
      pickupPhotoFront?: string;
      pickupPhotoBack?: string;
      pickupPhotoLeft?: string;
      pickupPhotoRight?: string;
      pickupPhotoWithVehicle?: string;
      shiftId?: string;
    }
  ) {
    const {
      vehicleId,
      hubId,
      teamLeaderId,
      emergencyContact,
      pickupPhotoFront,
      pickupPhotoBack,
      pickupPhotoLeft,
      pickupPhotoRight,
      pickupPhotoWithVehicle,
    } = input;

    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true, currentPlanRef: true },
    });
    if (!rider) throw new Error('Rider not found');

    // Resolve vehicle by multiple identifiers
    const vehicle = await db.vehicle.findFirst({
      where: {
        OR: [
          { id: vehicleId },
          { vehicleId: vehicleId },
          { vehicleId: vehicleId.toUpperCase() },
          { vehicleId: vehicleId.toLowerCase() },
          { vehicleNumber: vehicleId },
          { vehicleNumber: vehicleId.toUpperCase() },
          { vehicleNumber: vehicleId.toLowerCase() },
        ],
      },
      include: { hub: true },
    });
    if (!vehicle) throw new Error('Vehicle not found');
    const resolvedHubName = hubId
      ? (await db.hub.findUnique({ where: { id: hubId } }))?.name || 'Unknown Hub'
      : vehicle.hub?.name || 'Unknown Hub';

    // Atomic claim: check availability + update vehicle status + rider data atomically
    const updatedRider = await db.$transaction(async (tx) => {
      // Atomic conditional claim — claim if vehicle is AVAILABLE or RESERVED
      const claimResult = await tx.vehicle.updateMany({
        where: { id: vehicle.id, status: { in: ['AVAILABLE', 'RESERVED'] } },
        data: { status: 'ACTIVE_RENTAL', assignedAt: new Date() },
      });
      if (claimResult.count === 0) {
        // Check if this rider already owns the vehicle (re-pickup scenario)
        const currentVehicle = await tx.vehicle.findUnique({ where: { id: vehicle.id }, select: { status: true } });
        if (currentVehicle && rider.vehicleId === vehicle.id) {
          // Rider already has this vehicle assigned — allow re-pickup
        } else {
          throw new Error(
            `Vehicle is currently ${currentVehicle?.status?.toLowerCase() || 'unavailable'}. It may have been claimed by another rider.`
          );
        }
      }

      if (rider.vehicleId && rider.vehicleId !== vehicle.id) {
        await tx.vehicle.update({ where: { id: rider.vehicleId }, data: { status: 'AVAILABLE' } });
      }

      // F-04: Ensure RentalLease exists in ACTIVE status for both legacy bookRental path
      // and new active onboarding path (where bookRental was bypassed).
      await ensureActiveRentalLease(tx, rider, vehicle.id, { shiftId: input.shiftId });

      // PR-ONBOARDING-FLOW-2026-08-12: the new active path skips the
      // explicit `bookRental` step (no shift/date selection — the rider
      // picks a vehicle + completes the form in one go). The rider is
      // still in PLAN_SELECTED when they hit `syncPickup`. Accept
      // PLAN_SELECTED here so the lifecycle guard doesn't reject them.
      // F-20: Synchronized with completeVerification.ts allowed statuses.
      // Accept PLAN_SELECTED, PICKUP_SCHEDULED, ACTIVE, DEPOSIT_APPROVED, and KYC_APPROVED.
      const riderClaim = await tx.rider.updateMany({
        where: {
          id: riderDbId,
          // Only PICKUP_SCHEDULED, ACTIVE (re-pickup), DEPOSIT_APPROVED,
          // PLAN_SELECTED, or KYC_APPROVED riders are eligible.
          // SUSPENDED / CLOSED are explicitly excluded so admin intervention is required to unstick.
          lifecycleStatus: {
            in: ['PLAN_SELECTED', 'PICKUP_SCHEDULED', 'ACTIVE', 'DEPOSIT_APPROVED', 'KYC_APPROVED'],
          },
        },
        data: {
          pickedUpAt: new Date(),
          // PR-ONBOARDING-FLOW-2026-08-12: do NOT flip a pre-active rider to
          // ACTIVE here. The new active path requires TWO admin
          // approvals (KYC + security-deposit / wallet top-up) before
          // the rider becomes active. syncPickup stops at
          // PICKUP_SCHEDULED; a separate admin-side activation (or
          // both approvals landing) flips the rider to ACTIVE and
          // the HangTight screen auto-redirects to the dashboard.
          // If the rider was already ACTIVE (re-pickup), preserve ACTIVE.
          lifecycleStatus: rider.lifecycleStatus === 'ACTIVE' ? 'ACTIVE' : 'PICKUP_SCHEDULED',
          vehicleId: vehicle.id,
          assignedVehicle: vehicle.vehicleNumber,
          pickupHub: resolvedHubName,
          teamLeaderId: teamLeaderId || null,
          emergencyContact: emergencyContact || null,
          pickupPhotoFront: pickupPhotoFront || null,
          pickupPhotoBack: pickupPhotoBack || null,
          pickupPhotoLeft: pickupPhotoLeft || null,
          pickupPhotoRight: pickupPhotoRight || null,
          pickupPhotoWithVehicle: pickupPhotoWithVehicle || null,
        },
      });
      if (riderClaim.count === 0) {
        throw new Error(
          'Rider is not in a pickup-eligible state (must be PLAN_SELECTED, PICKUP_SCHEDULED, DEPOSIT_APPROVED, KYC_APPROVED, or ACTIVE).'
        );
      }
      return tx.rider.findUnique({
        where: { id: riderDbId },
        include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true, currentPlanRef: true },
      });
    });

    // The guard above throws when the rider is not in a pickup-eligible
    // state, so `updatedRider` is always non-null on the success path.
    if (!updatedRider) {
      throw new Error('Rider disappeared mid-pickup');
    }
    const flatRider = flattenRider(updatedRider);
    return signRiderUrls(flatRider);
  },

  // PR-ONBOARDING-2026-08-11 (audit 2.16): `requestReturn` was the pre-PR-26b
  // chokepoint that transitioned the rider to RETURN_PENDING without
  // creating a VehicleReturn row. The live route at
  // `app/api/rider/rental/return/route.ts` uses `submitReturn` instead;
  // any caller of the old method would create a return the admin queue
  // cannot see. Removed.
};
export { RentalBookError };
