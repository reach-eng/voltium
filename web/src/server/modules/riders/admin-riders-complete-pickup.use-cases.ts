import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';
import { NotFoundError } from "@/lib/api-error";

/**
 * Complete pickup for a rider — assigns vehicle, activates account.
 */
export async function completePickup(
  riderId: string,
  data: { vehicleId?: string; hubId?: string; teamLeader?: string },
  actorId: string,
  actorRole: string
) {
  const rider = await db.rider.findUnique({ where: { id: riderId } });
  if (!rider) throw new NotFoundError('Rider not found');

  let assignedTl = data.teamLeader || rider.teamLeader;
  if (!assignedTl || assignedTl === 'Not Assigned') {
    const activeTl = await db.teamLeader.findFirst({ where: { isActive: true } });
    assignedTl = activeTl ? activeTl.name : 'Amit Sharma';
  }

  let assignedVehicleString = 'VF-ASSIGNED-BY-ADMIN';
  if (data.vehicleId) {
    const v = await db.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (v) assignedVehicleString = v.vehicleNumber;
  }

  await transitionRiderStatus(riderId, 'ACTIVE');
  const result = await db.rider.update({
    where: { id: riderId },
    data: {
      pickedUpAt: new Date(),
      assignedVehicle: assignedVehicleString,
      pickupHub: data.hubId || 'Central Hub',
      teamLeader: assignedTl,
    },
    include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
  });

  await createAuditLog({
    actorId,
    action: 'rider.complete_pickup',
    entity: 'Rider',
    entityId: riderId,
    details: { vehicleId: data.vehicleId, hubId: data.hubId, manual: true },
  }).catch(() => {});
  return result;
}
