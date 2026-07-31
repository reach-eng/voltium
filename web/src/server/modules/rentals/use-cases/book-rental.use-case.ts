import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { calculateDynamicPrice } from '@/lib/dynamic-pricing';
import { RentalBookError } from './errors';

export async function bookRental(
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
      basePrice: lease.basePriceInPaise,
      finalPrice: lease.finalPriceInPaise,
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
}
