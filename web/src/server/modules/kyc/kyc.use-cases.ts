/**
 * KYC module - Use cases.
 *
 * Orchestrates KYC submission, review, and document verification workflows.
 */

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { KycSubmission, KycReview } from './kyc.types';
import { kycRepository } from './kyc.repository';
import { notificationService } from '@/lib/notification-service';
import { OutboxService, OutboxEventTypes } from '@/server/workers/outbox';
import { createAuditLog } from '@/lib/audit-log';

export const kycUseCases = {
  async getKycStatus(riderDbId: string) {
    return kycRepository.findByRiderId(riderDbId);
  },

  /**
   * NET-005 follow-up-13 (2026-09-08): admin "Re-verify"
   * action wrapper. Delegates to
   * `kycRepository.reopenExpiredKyc` (the state-machine
   * + write lives in the repo) and adds the audit log
   * + outbox notification so the rider is told their
   * KYC needs re-submission.
   *
   * The audit log uses the dot-separated `kyc.reopened`
   * form, matching the prefix-sweep contract from
   * NET-005 follow-up-3 + follow-up-5. The
   * `REOPENED → PENDING` transition is the only valid
   * admin re-verify path; other transitions throw
   * `KycStateError` from the state machine and are
   * mapped to 409 by the route layer.
   */
  async reopenExpiredKyc(riderDbId: string, reviewerId: string) {
    const result = await kycRepository.reopenExpiredKyc(riderDbId, reviewerId);
    // Audit log + outbox notification, fire-and-forget
    // so they don't block the response. Same pattern as
    // the REJECT / REQUEST_INFO branches above.
    createAuditLog({
      actorId: reviewerId,
      actorType: 'ADMIN',
      action: 'kyc.reopened',
      entity: 'KycProfile',
      entityId: result?.id ?? riderDbId,
      details: {
        riderId: riderDbId,
        previousStatus: 'EXPIRED',
        newStatus: 'PENDING',
      },
    }).catch((err) => logger.error('[KYC audit] kyc.reopened log failed', err));
    // Tell the rider their KYC needs re-submission.
    // The outbox dispatcher at
    // notification-dispatch.job.ts:90-95 handles the
    // `KYC_REOPENED` event type (already wired in
    // NET-005 follow-up-2 for KYC_REJECTED /
    // KYC_INFO_REQUESTED — same event family).
    await OutboxService.emit(
      OutboxEventTypes.NOTIFICATION_SEND,
      {
        riderId: riderDbId,
        type: 'KYC_REOPENED',
      },
      3,
      // No transaction — the audit log + outbox emit
      // are after the state change committed, and the
      // rider is not racing themselves to re-submit.
    );
    return result;
  },

  async submitKyc(riderDbId: string, input: KycSubmission) {
    // Map frontend field names to Prisma model field names
    const prismaData = mapKycFieldsToPrisma(input as unknown as Record<string, unknown>);

    // Progressive upload support:
    // Only transition to SUBMITTED if all critical docs are present
    // Partial uploads just save data and keep current status (DRAFT)
    const existing = await kycRepository.findByRiderId(riderDbId);

    if (
      (existing?.status === 'REJECTED' || existing?.status === 'INFO_REQUIRED') &&
      existing.editableFields &&
      existing.editableFields.length > 0
    ) {
      // Filter prismaData to ONLY allow fields present in editableFields
      const allowedKeys = new Set(existing.editableFields);
      for (const key of Object.keys(prismaData)) {
        if (!allowedKeys.has(key)) {
          delete prismaData[key];
        }
      }
    }

    const existingData = (existing || {}) as Record<string, unknown>;
    const aadhaarFront = prismaData.aadhaarFront || existingData.aadhaarFront;
    const aadhaarBack = prismaData.aadhaarBack || existingData.aadhaarBack;
    const panCard = prismaData.panCard || existingData.panCard;
    const profilePhoto = prismaData.profilePhoto || existingData.profilePhoto;

    if (aadhaarFront && aadhaarBack && panCard && profilePhoto) {
      // All critical docs present → full submission with status transition
      return kycRepository.submitKyc(riderDbId, prismaData);
    }

    // Partial upload — upsert data without status transition
    return kycRepository.savePartialKyc(riderDbId, prismaData);
  },

  async reviewKyc(riderDbId: string, reviewerId: string, review: KycReview) {
    switch (review.action) {
      case 'APPROVE': {
        return db.$transaction(async (tx) => {
          const result = await kycRepository.approveKyc(riderDbId, reviewerId);
          // BLOCKER 2.7: notification is dispatched by the outbox
          // worker (notificationDispatchJob, Phase 1.4). The repository
          // no longer fires a duplicate notification. Emitting the
          // event inside the transaction guarantees at-least-once
          // delivery with retry/backoff.
          await OutboxService.emit(OutboxEventTypes.NOTIFICATION_SEND, {
            riderId: riderDbId,
            type: 'KYC_APPROVED',
          }, 3, tx,
          // PR-75: KYC notification dispatch is interactive (rider
          // expects timely feedback on KYC decisions).
          'interactive');
          return result;
        });
      }
      case 'REJECT': {
        const rejectionReason = review.rejectionReason || '';
        const editableFields = review.editableFields || [];
        // NET-005 follow-up-8 (2026-09-08): the previous
        // status must be read BEFORE the transaction. The
        // old code read it after the transaction committed,
        // so `previous.status` always equalled the new
        // status (the transition had just written it). The
        // audit log wrote `previousStatus: 'REJECTED',
        // newStatus: 'REJECTED'` — a useless transition
        // record. Reading the snapshot before the
        // transaction captures the actual pre-transition
        // status.
        const previousSnapshot = await db.kycProfile.findUnique({
          where: { riderId: riderDbId },
          select: { id: true, status: true },
        });
        const result = await db.$transaction(async (tx) => {
          const rejectResult = await kycRepository.rejectKyc(riderDbId, reviewerId, rejectionReason, editableFields);
          await OutboxService.emit(OutboxEventTypes.NOTIFICATION_SEND, {
            riderId: riderDbId,
            type: 'KYC_REJECTED',
            reason: rejectionReason,
          }, 3, tx,
          // PR-75: KYC notification dispatch is interactive.
          'interactive');
          return rejectResult;
        });
        // PR-ONBOARDING-2026-08-11 (audit 2.7): REJECT was the only
        // KYC decision that left no audit trail. APPROVE writes
        // `kyc.approved` (PR-26b); REQUEST_INFO is fixed below. Now
        // REJECT writes `kyc.rejected` with the reviewer id and the
        // reason so admins can answer "who rejected this and why"
        // without grepping the outbox event log. Fire-and-forget
        // outside the transaction so the audit write cannot block the
        // state change.
        if (previousSnapshot) {
          createAuditLog({
            actorId: reviewerId,
            actorType: 'ADMIN',
            action: 'kyc.rejected',
            entity: 'KycProfile',
            entityId: previousSnapshot.id,
            details: {
              riderId: riderDbId,
              previousStatus: previousSnapshot.status,
              newStatus: 'REJECTED',
              reason: rejectionReason,
              editableFields,
            },
          }).catch((err) =>
            logger.error('[KYC audit] kyc.rejected log failed', err)
          );
        }
        return result;
      }
      case 'REQUEST_INFO': {
        const infoRequest = review.infoRequest || 'Additional information required';
        // NET-005 follow-up-8 (2026-09-08): same fix as
        // the REJECT case above — read the pre-transition
        // status before the transition. The old code read
        // it after `kycRepository.requestInfo` had already
        // written `INFO_REQUIRED`, so `previous.status`
        // always equalled the new status.
        const previousSnapshot = await db.kycProfile.findUnique({
          where: { riderId: riderDbId },
          select: { id: true, status: true },
        });
        // NET-005 follow-up-14 (2026-09-08): the
        // previous code called
        // `kycRepository.requestInfo(...)` (which has
        // its own transaction) and then
        // `OutboxService.emit(...)` WITHOUT a `tx`
        // argument — so the notification was outside
        // the DB write. If the DB write committed but
        // the Outbox emit failed, the rider would see
        // a `INFO_REQUIRED` status with no
        // notification (or vice versa). APPROVE and
        // REJECT wrap their repo call + outbox emit in
        // a single `db.$transaction(...)` and pass the
        // `tx` to the outbox; REQUEST_INFO was missed.
        // Move REQUEST_INFO into the same shape so the
        // KYC_INFO_REQUESTED outbox row commits
        // atomically with the kycProfile status
        // write. The audit log remains fire-and-forget
        // (it doesn't need to be transactional — losing
        // one row is recoverable from the state
        // machine + the kycProfile row, while a
        // failed outbox emit is not).
        const result = await db.$transaction(async (tx) => {
          const requestInfoResult = await kycRepository.requestInfo(
            riderDbId,
            reviewerId,
            infoRequest,
            review.editableFields || []
          );
          // PR-ONBOARDING-2026-08-11 (audit 3.1 P2):
          // REQUEST_INFO used a direct
          // `notificationService` call (fire-and-
          // forget) while APPROVE / REJECT use the
          // outbox. Move it onto the outbox so
          // retry/backoff is consistent across KYC
          // decisions. The dispatcher at
          // `notification-dispatch.job.ts:90-95`
          // already handles the `KYC_INFO_REQUESTED`
          // event type.
          await OutboxService.emit(
            OutboxEventTypes.NOTIFICATION_SEND,
            {
              riderId: riderDbId,
              type: 'KYC_INFO_REQUESTED',
              infoRequest,
            },
            3,
            tx,
            // PR-75: KYC notification dispatch is
            // interactive (rider expects timely
            // feedback on KYC decisions).
            'interactive'
          );
          return requestInfoResult;
        });
        // PR-ONBOARDING-2026-08-11 (audit 2.7):
        // REQUEST_INFO left no audit trail. Writes
        // `kyc.requested_info` with reviewer id and
        // the info text. Fire-and-forget; failure
        // does not block the state change.
        if (previousSnapshot) {
          createAuditLog({
            actorId: reviewerId,
            actorType: 'ADMIN',
            action: 'kyc.info_required',
            entity: 'KycProfile',
            entityId: previousSnapshot.id,
            details: {
              riderId: riderDbId,
              previousStatus: previousSnapshot.status,
              newStatus: 'INFO_REQUIRED',
              infoRequest,
            },
          }).catch((err) =>
            logger.error('[KYC audit] kyc.requested_info log failed', err)
          );
        }
        return result;
      }
    }
  },
};

const ALLOWED_PRISMA_KYC_FIELDS = new Set([
  'status',
  'profilePhoto',
  'riderPhoto',
  'signature',
  'aadhaarFront',
  'aadhaarBack',
  'aadhaarNumber',
  'panCard',
  'panNumber',
  'accountNumber',
  'ifscCode',
  'bankName',
  'rejectionReason',
  'editableFields',
  'verifiedAt',
  'rejectionCount',
]);

/**
 * Maps frontend field names to Prisma KycProfile model field names.
 * The validation schema uses 'bankAccount'/'bankIfsc' but Prisma expects
 * 'accountNumber'/'ifscCode'.
 * P1-S8: Drops any unrecognized keys not in ALLOWED_PRISMA_KYC_FIELDS.
 */
function mapKycFieldsToPrisma(input: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === 'bankAccount') {
      mapped.accountNumber = value;
    } else if (key === 'bankIfsc') {
      mapped.ifscCode = value;
    } else if (ALLOWED_PRISMA_KYC_FIELDS.has(key)) {
      mapped[key] = value;
    }
  }
  return mapped;
}
