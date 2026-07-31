/**
 * Rider — Lifecycle Status Transitions
 *
 * Reject plan, get current state — lifecycle status transitions and queries.
 */

import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import type { RiderState } from './rider.types';
import { riderRepository } from './rider.repository';
import { NotFoundError } from "@/lib/api-error";

/**
 * Reject a rider's plan — reverts to GUARANTOR_APPROVED status.
 */
export async function rejectPlan(riderDbId: string, adminId: string, reason: string) {
  const rider = await db.rider.findUnique({ where: { id: riderDbId } });
  if (!rider) throw new NotFoundError('Rider not found');

  await db.rider.update({
    where: { id: riderDbId },
    data: {
      planDoneAt: null,
      currentPlan: null,
      planRejectionReason: reason,
      lifecycleStatus: 'GUARANTOR_APPROVED',
    },
  });

  await createAuditLog({
    actorId: adminId,
    actorType: 'ADMIN',
    action: 'REJECT',
    entity: 'RiderPlan',
    entityId: riderDbId,
    details: { reason },
  });
}

/**
 * Get the full lifecycle state for a rider.
 */
export async function getState(riderDbId: string): Promise<RiderState | null> {
  const rider = await riderRepository.getFullState(riderDbId);
  if (!rider) return null;

  const activeLease = (rider.leases || []).find((lease: any) =>
    ['BOOKED', 'PICKUP_SCHEDULED', 'ACTIVE', 'OVERDUE', 'RETURN_PENDING'].includes(lease.status)
  );

  return {
    riderId: rider.riderId,
    phone: rider.phone,
    fullName: rider.fullName || '',
    lifecycleStatus: rider.lifecycleStatus as RiderState['lifecycleStatus'],
    isOnboarded: ['ACTIVE', 'RETURN_PENDING', 'CLOSED'].includes(rider.lifecycleStatus),
    kycStatus: rider.kycProfile?.status || 'PENDING',
    guarantorStatus: rider.guarantor?.status || 'PENDING',
    depositStatus: rider.wallet?.depositStatus || 'NOT_SUBMITTED',
    rentalStatus:
      activeLease?.status || (rider.lifecycleStatus === 'ACTIVE' ? 'ACTIVE' : 'NO_RENTAL'),
    activePlan: rider.currentPlan
      ? {
          id: rider.currentPlan,
          startDate: rider.planStartDate,
          endDate: rider.planEndDate,
        }
      : null,
    assignedVehicle:
      rider.vehicleId || rider.assignedVehicle
        ? { id: rider.vehicleId, vehicleId: rider.assignedVehicle }
        : null,
    walletBalance: rider.wallet?.balanceInPaise || 0,
  };
}
