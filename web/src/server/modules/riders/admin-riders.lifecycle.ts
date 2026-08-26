/**
 * Admin Riders — Lifecycle & State Transitions
 *
 * Status progression, rank safeguards, suspension, reactivation, and termination.
 */

import { db } from '@/lib/db';
import { RiderLifecycleStatus } from '@prisma/client';
import { lifecycleRankOf } from '@/lib/lifecycle-ranks';
import { sanitizeText } from '@/lib/sanitize';
import { createAuditLog } from '@/lib/audit-log';
import { logAccountSuspension } from '@/lib/security-events';
import { invalidateRiderCache } from '@/lib/server-cache';

export const SAFE_RIDER_FIELDS = new Set([
  'fullName',
  'email',
  'fatherName',
  'motherName',
  'dob',
  'currentAddress',
  'emergencyContact',
  'pickupHub',
  'teamLeaderId',
  'planStartDate',
  'planEndDate',
  'intent',
  'referralCode',
  'phone',
  'preferredShift',
  'referredBy',
  'assignedVehicle',
  'vehicleId',
  'currentPlan',
  'currentPlanId',
  'pickedUpAt',
  'lifecycleStatus',
  'registrationDoneAt',
  'depositDoneAt',
  'kycDoneAt',
  'planDoneAt',
]);

export function processSafeRiderData(data: Record<string, unknown>): Record<string, unknown> {
  const riderData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SAFE_RIDER_FIELDS.has(key)) {
      riderData[key] = typeof value === 'string' ? sanitizeText(value) : value;
    }
  }
  return riderData;
}

export function syncLifecycleWithKycStatus(
  existingStatus: RiderLifecycleStatus,
  kycStatus: string,
  riderData: Record<string, unknown>,
  guarantorData: Record<string, unknown>,
  existingGuarantorStatus?: string | null
): { wasSuspended: boolean } {
  let wasSuspended = false;

  if (kycStatus === 'APPROVED') {
    const currentRank = lifecycleRankOf(existingStatus);
    if (currentRank <= 4) {
      riderData.lifecycleStatus = 'KYC_APPROVED';
    }
    riderData.kycDoneAt = new Date();
    if (existingGuarantorStatus === 'SUBMITTED') {
      guarantorData.status = 'APPROVED';
    }
  } else if (kycStatus === 'REJECTED' || kycStatus === 'INFO_REQUIRED') {
    wasSuspended = kycStatus === 'REJECTED';
    const currentRank = lifecycleRankOf(existingStatus);
    if (currentRank <= 4) {
      riderData.lifecycleStatus = wasSuspended ? 'SUSPENDED' : 'KYC_SUBMITTED';
    }
    guarantorData.status = wasSuspended ? 'REJECTED' : 'INFO_REQUIRED';
  }

  return { wasSuspended };
}

export async function suspendRider(
  riderId: string,
  actorId: string,
  reason: string = 'admin_action'
): Promise<void> {
  await db.rider.update({
    where: { id: riderId },
    data: { lifecycleStatus: 'SUSPENDED' },
  });
  invalidateRiderCache(riderId);
  await logAccountSuspension({ riderId, adminId: actorId, reason });
  await createAuditLog({
    actorId,
    actorType: 'ADMIN',
    action: 'rider.suspended',
    entity: 'rider',
    entityId: riderId,
    details: { reason },
  });
}

export async function reactivateRider(
  riderId: string,
  actorId: string,
  targetStatus: RiderLifecycleStatus = 'ACTIVE'
): Promise<void> {
  await db.rider.update({
    where: { id: riderId },
    data: { lifecycleStatus: targetStatus },
  });
  invalidateRiderCache(riderId);
  await createAuditLog({
    actorId,
    actorType: 'ADMIN',
    action: 'rider.reactivated',
    entity: 'rider',
    entityId: riderId,
    details: { targetStatus },
  });
}
