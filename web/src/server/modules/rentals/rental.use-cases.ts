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
import { rentalRepository } from './rental.repository';
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
    const totalVehicles = await db.vehicle.count({ where: { hubId: vehicle.hubId } });
    const availableVehicles = await db.vehicle.count({
      where: { hubId: vehicle.hubId, status: 'AVAILABLE' },
    });
    const availabilityRatio = totalVehicles > 0 ? availableVehicles / totalVehicles : 0;

    const dailyRentSetting = await db.systemSetting.findUnique({ where: { key: 'dailyRent' } });
    const basePricePaise = dailyRentSetting ? parseInt(dailyRentSetting.value) || 18000 : 18000;

    const dynamicPrice = calculateDynamicPrice(basePricePaise, {
      hubId: vehicle.hub.id,
      hubName: vehicle.hub.name,
      totalVehicles,
      availableVehicles,
      availabilityRatio,
    });

    // Create RentalLease + update vehicle status atomically with race-condition guards
    const lease = await db.$transaction(async (tx: Prisma.TransactionClient) => {
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

      const newLease = await tx.rentalLease.create({
        data: {
          vehicleId,
          riderId: riderDbId,
          shiftId,
          leaseDate,
          startTime,
          basePriceInPaise: dynamicPrice.basePrice,
          finalPriceInPaise: dynamicPrice.finalPrice,
          status: 'BOOKED',
        },
        include: {
          vehicle: { select: { id: true, vehicleId: true, model: true } },
          shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        },
      });

      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { status: 'RESERVED' },
      });

      await tx.rider.updateMany({
        where: { id: riderDbId, lifecycleStatus: { in: ['PLAN_SELECTED', 'DEPOSIT_APPROVED'] } },
        data: {
          lifecycleStatus: 'PICKUP_SCHEDULED',
          vehicleId,
          assignedVehicle: vehicle.vehicleNumber,
        },
      });

      return newLease;
    });

    return {
      lease: {
        id: lease.id,
        status: lease.status,
        leaseDate: lease.leaseDate,
        startTime: lease.startTime,
        basePrice: lease.basePrice,
        finalPrice: lease.finalPrice,
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

  async startRental(riderDbId: string, vehicleId: string, hubId: string, teamLeader: string) {
    return rentalRepository.startRental(riderDbId, vehicleId, hubId, teamLeader);
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
      teamLeader?: string;
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
      teamLeader,
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
    const updatedRider = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Atomic conditional claim — only claim if vehicle is AVAILABLE
      const claimResult = await tx.vehicle.updateMany({
        where: { id: vehicle.id, status: 'AVAILABLE' },
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
          status: { in: ['BOOKED', 'PICKUP_SCHEDULED' as any] },
        },
        data: { status: 'ACTIVE', startTime: new Date().toTimeString().slice(0, 5) },
      });

      return tx.rider.update({
        where: { id: riderDbId },
        data: {
          pickedUpAt: new Date(),
          lifecycleStatus: 'ACTIVE',
          vehicleId: vehicle.id,
          assignedVehicle: vehicle.vehicleNumber,
          pickupHub: resolvedHubName,
          teamLeader: teamLeader || null,
          emergencyContact: emergencyContact || null,
          pickupPhotoFront: pickupPhotoFront || null,
          pickupPhotoBack: pickupPhotoBack || null,
          pickupPhotoLeft: pickupPhotoLeft || null,
          pickupPhotoRight: pickupPhotoRight || null,
          pickupPhotoWithVehicle: pickupPhotoWithVehicle || null,
        },
        include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
      });
    });

    const flatRider = flattenRider(updatedRider as any);
    return signRiderUrls(flatRider);
  },

  async requestReturn(riderDbId: string) {
    return rentalRepository.endRental(riderDbId);
  },
};
export { RentalBookError };
