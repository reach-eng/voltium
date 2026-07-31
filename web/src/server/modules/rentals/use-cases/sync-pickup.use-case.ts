import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { flattenRider } from '@/lib/flatten-rider';
import { signRiderUrls } from '@/lib/sign-rider';
import { NotFoundError, ValidationError } from "@/lib/api-error";

export async function syncPickup(
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
    startOdometer?: number;
    startBatteryPct?: number;
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
  if (!rider) throw new NotFoundError('Rider not found');

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
  if (!vehicle) throw new NotFoundError('Vehicle not found');

  if (hubId && vehicle.hubId && vehicle.hubId !== hubId) {
    throw new ValidationError(`Vehicle ${vehicle.vehicleNumber} is assigned to hub "${vehicle.hub?.name || vehicle.hubId}", not the selected pickup hub.`);
  }

  const resolvedHubName = hubId
    ? (await db.hub.findUnique({ where: { id: hubId } }))?.name || vehicle.hub?.name || 'Unknown Hub'
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
        throw new ValidationError(
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
      data: {
        status: 'ACTIVE',
        startTime: new Date().toTimeString().slice(0, 5),
        ...(typeof input.startOdometer === 'number' ? { startOdometer: input.startOdometer } : {}),
        ...(typeof input.startBatteryPct === 'number' ? { startBatteryPct: input.startBatteryPct } : {}),
      },
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
}
