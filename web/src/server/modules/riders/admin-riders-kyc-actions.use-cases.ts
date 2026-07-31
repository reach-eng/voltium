/**
 * Admin Riders — KYC Actions
 *
 * KYC field allowlists, status-change audit logging, and notification dispatch.
 */

import { sanitizeText } from '@/lib/sanitize';
import { createAuditLog } from '@/lib/audit-log';
import { notificationService } from '@/lib/notification-service';
import { logger } from '@/lib/logger';

export const KYC_FIELDS = new Set([
  'kycStatus',
  'profilePhoto',
  'riderPhoto',
  'signature',
  'aadhaarFront',
  'aadhaarBack',
  'aadhaarNumber',
  'panCard',
  'panNumber',
  'bankAccount',
  'bankIfsc',
  'bankName',
  'accountNumber',
  'ifscCode',
  'rejectionReason',
  'editableFields',
]);

/**
 * Partition incoming data into KYC-specific fields.
 * Returns an object suitable for upserting into the kycProfile table.
 */
export function extractKycData(data: Record<string, unknown>): Record<string, unknown> {
  const kycData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!KYC_FIELDS.has(key)) continue;
    if (key === 'kycStatus') {
      kycData.status = value;
    } else {
      kycData[key] = typeof value === 'string' ? sanitizeText(value) : value;
    }
  }
  return kycData;
}

/**
 * Compute lifecycle status changes triggered by a KYC status transition.
 * Returns rider-level data patches (e.g. lifecycleStatus, kycDoneAt) and guarantor data patches.
 */
export function getKycLifecycleSync(
  kycStatus: string | undefined
): { riderPatch: Record<string, unknown>; guarantorPatch: Record<string, unknown> } {
  const riderPatch: Record<string, unknown> = {};
  const guarantorPatch: Record<string, unknown> = {};

  if (kycStatus === 'APPROVED') {
    riderPatch.lifecycleStatus = 'KYC_APPROVED';
    riderPatch.kycDoneAt = new Date();
    guarantorPatch.status = 'APPROVED';
  }
  if (kycStatus === 'REJECTED' || kycStatus === 'INFO_REQUIRED') {
    riderPatch.lifecycleStatus = kycStatus === 'REJECTED' ? 'SUSPENDED' : 'KYC_SUBMITTED';
    guarantorPatch.status = kycStatus === 'REJECTED' ? 'REJECTED' : 'INFO_REQUIRED';
  }

  return { riderPatch, guarantorPatch };
}

/**
 * Write an audit log entry and fire a notification for a KYC status change.
 * All errors are swallowed (fire-and-forget).
 */
export async function logKycAuditAndNotify(
  riderId: string,
  kycStatus: string,
  rejectionReason: string | undefined,
  actorId: string
): Promise<void> {
  if (!['APPROVED', 'REJECTED', 'INFO_REQUIRED'].includes(kycStatus)) return;

  createAuditLog({
    actorId,
    actorType: 'ADMIN',
    action: `kyc_${kycStatus.toLowerCase()}`,
    entity: 'rider',
    entityId: riderId,
    details: JSON.stringify({
      kycStatus,
      rejectionReason: rejectionReason || null,
    }),
  }).catch(() => {});

  notificationService
    .notifyKycStatusChange(riderId, kycStatus, rejectionReason)
    .catch((e) => logger.error('Failed to notify KYC change', e));
}
