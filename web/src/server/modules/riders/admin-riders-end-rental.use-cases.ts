import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';

/**
 * End rental for a rider — resets rental state.
 */
export async function endRental(riderId: string, actorId: string) {
  const rider = await db.rider.findUnique({
    where: { id: riderId },
    select: { assignedVehicle: true },
  });
  const result = await db.rider.update({
    where: { id: riderId },
    data: { assignedVehicle: null, pickedUpAt: null },
    include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
  });

  await createAuditLog({
    actorId,
    action: 'rider.end_rental',
    entity: 'Rider',
    entityId: riderId,
    details: { previousVehicle: rider?.assignedVehicle },
  }).catch(() => {});
  return result;
}
