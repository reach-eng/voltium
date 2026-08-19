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
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
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

      await tx.rentalLease.updateMany({
        where: {
          riderId: riderDbId,
          vehicleId: vehicle.id,
          status: { in: ['BOOKED', 'PICKUP_SCHEDULED'] as const },
        },
        // P1.3: startTime must be UTC (toISOString), not server-local time.
        // PR-ONBOARDING-FLOW-2026-08-12: in the new active path no lease
        // exists yet (the rider skipped the explicit bookRental step).
        // count === 0 is expected and OK — the rider is being flipped to
        // ACTIVE directly. The lease will be reconciled by background
        // jobs or admin tools if needed for billing.
        data: { status: 'ACTIVE', startTime: utcNowHHMM() },
      });

      // PR-ONBOARDING-FLOW-2026-08-12: the new active path skips the
      // explicit `bookRental` step (no shift/date selection — the rider
      // picks a vehicle + completes the form in one go). The rider is
      // still in PLAN_SELECTED when they hit `syncPickup`. Accept
      // PLAN_SELECTED here so the lifecycle guard doesn't reject them.
      const riderClaim = await tx.rider.updateMany({
        where: {
          id: riderDbId,
          // Only PICKUP_SCHEDULED, ACTIVE (re-pickup), or DEPOSIT_APPROVED
          // riders are eligible. SUSPENDED / CLOSED are explicitly
          // excluded so admin intervention is required to unstick.
          // PR-ONBOARDING-FLOW-2026-08-12: PLAN_SELECTED added so the
          // new active path (no explicit bookRental) can complete
          // pickup in a single round-trip.
          lifecycleStatus: {
            in: ['PLAN_SELECTED', 'PICKUP_SCHEDULED', 'ACTIVE', 'DEPOSIT_APPROVED'],
          },
        },
        data: {
          pickedUpAt: new Date(),
          // PR-ONBOARDING-FLOW-2026-08-12: do NOT flip the rider to
          // ACTIVE here. The new active path requires TWO admin
          // approvals (KYC + security-deposit / wallet top-up) before
          // the rider becomes active. syncPickup now stops at
          // PICKUP_SCHEDULED; a separate admin-side activation (or
          // both approvals landing) flips the rider to ACTIVE and
          // the HangTight screen auto-redirects to the dashboard.
          lifecycleStatus: 'PICKUP_SCHEDULED',
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
          'Rider is not in a pickup-eligible state (must be PLAN_SELECTED, PICKUP_SCHEDULED, DEPOSIT_APPROVED, or ACTIVE).'
        );
      }
      return tx.rider.findUnique({
        where: { id: riderDbId },
        include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
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
