/**
 * approveKyc — KYC approval use case (PR-26b, API N3)
 *
 * Extracted from the rider `updateProfile` chokepoint. This use case owns
 * the cross-entity invariants around approving a submitted KYC:
 *
 *   1. KYC must be in `status === 'SUBMITTED'` — the state machine
 *      (`kyc-state-machine.ts`) is the source of truth and is enforced by
 *      `kycRepository.approveKyc`. This use case re-checks before
 *      delegating so the error message is caller-friendly.
 *   2. Hand off to `kycRepository.approveKyc`, which writes the
 *      APPROVED status, advances the rider's lifecycleStatus to
 *      `KYC_APPROVED`, and dispatches the notification via the outbox
 *      worker (kycUseCases.reviewKyc emits NOTIFICATION_SEND).
 *   3. Write a non-blocking audit log entry (`kyc.approved`) — this is
 *      the "fix the carry-over" the audit plan flags. The existing
 *      `kycRepository.approveKyc` does NOT call `createAuditLog`, so this
 *      use case is where the audit trail lives.
 *
 * The KYC admin route (POST /api/admin/kyc with action=APPROVE) already
 * calls `kycUseCases.reviewKyc` — but that path is shared with REJECT and
 * REQUEST_INFO. The audit says approve deserves its own use case so
 * future approve-specific logic (e.g. notify the wallet, trigger referral
 * rewards) can be added without coupling to the other review actions.
 *
 * IMPORTANT: This is a NEW entry point. The existing
 * `kycUseCases.reviewKyc({ action: 'APPROVE' })` path is preserved as a
 * thin wrapper that delegates here, so the admin route keeps working
 * without a migration window.
 */

import { kycRepository } from '../kyc.repository';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { KycApproveError } from './errors';

export interface ApproveKycResult {
  id: string;
  status: 'APPROVED';
  riderId: string;
}

/**
 * Approve a submitted KYC.
 *
 * @param riderDbId Rider's internal database id.
 * @param approvedBy Admin id (or 'SYSTEM' for automated approvals) for audit.
 * @returns The approved KYC profile.
 *
 * @throws KycApproveError on precondition failure (KYC not in SUBMITTED).
 * @throws KycStateError (from kycRepository.approveKyc) on illegal transition.
 */
export async function approveKyc(
  riderDbId: string,
  approvedBy: string
): Promise<ApproveKycResult> {
  if (!approvedBy) {
    throw new KycApproveError('approvedBy is required for KYC approval', 'MISSING_ACTOR');
  }

  // ── Precondition: KYC must be in SUBMITTED state ────────────────────
  // The repository re-validates via the state machine, but checking here
  // gives callers a clean, typed error code.
  const existing = await kycRepository.findByRiderId(riderDbId);
  if (!existing) {
    throw new KycApproveError(`No KYC profile found for rider ${riderDbId}`, 'NOT_FOUND');
  }
  if (existing.status !== 'SUBMITTED') {
    throw new KycApproveError(
      `Cannot approve KYC: current status is "${existing.status}", expected "SUBMITTED".`,
      'INVALID_STATE'
    );
  }

  // ── Delegate to the repository for the actual state transition + lifecycle bump ──
  const kyc = await kycRepository.approveKyc(riderDbId, approvedBy);

  // ── Audit log — "fix the carry-over" from the audit plan ────────────
  // The repository does NOT write an audit log; this is the gap PR-26b closes.
  await createAuditLog({
    actorId: approvedBy,
    actorType: 'ADMIN',
    action: 'kyc.approved',
    entity: 'KycProfile',
    entityId: kyc.id,
    details: { riderId: riderDbId, previousStatus: 'SUBMITTED', newStatus: 'APPROVED' },
  }).catch((err) => {
    logger.warn('[approveKyc] audit log write failed (non-blocking)', { err });
  });

  return {
    id: kyc.id,
    status: 'APPROVED',
    riderId: riderDbId,
  };
}
