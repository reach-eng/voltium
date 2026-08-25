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
// T-91 (PR-1, 2026-08-23): import the shared payload-type literal so
// the producer (here) and the consumer (notification-dispatch.job.ts)
// stay in lockstep. Previously the producer emitted
// `type: 'KYC_INFO_REQUESTED'` and the consumer only handled
// `KYC_INFO_REQUIRED` — the event was silently acked and the rider
// was never told their KYC needed action. See
// docs/AUDIT_WORKFLOWS_2026-08-23.md §1.2.
import type { NotificationPayloadType } from '@/server/workers/notification-payload-types';

export const kycUseCases = {
  async getKycStatus(riderDbId: string) {
    return kycRepository.findByRiderId(riderDbId);
  },

  async submitKyc(riderDbId: string, input: KycSubmission) {
    // Map frontend field names to Prisma model field names
    const prismaData = mapKycFieldsToPrisma(input as unknown as Record<string, unknown>);

    // Progressive upload support:
    // Only transition to SUBMITTED if all critical docs are present
    // Partial uploads just save data and keep current status (DRAFT)
    const existing = await kycRepository.findByRiderId(riderDbId);

    if (existing?.status === 'REJECTED' && existing.editableFields && existing.editableFields.length > 0) {
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
        const previous = await db.kycProfile.findUnique({
          where: { riderId: riderDbId },
          select: { id: true, status: true },
        });
        if (previous) {
          createAuditLog({
            actorId: reviewerId,
            actorType: 'ADMIN',
            action: 'kyc.rejected',
            entity: 'KycProfile',
            entityId: previous.id,
            details: {
              riderId: riderDbId,
              previousStatus: previous.status,
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
        const result = await kycRepository.requestInfo(riderDbId, reviewerId, infoRequest);
        // PR-ONBOARDING-2026-08-11 (audit 3.1 P2): REQUEST_INFO used
        // a direct `notificationService` call (fire-and-forget) while
        // APPROVE / REJECT use the outbox. Move it onto the outbox so
        // retry/backoff is consistent across KYC decisions.
        //
        // T-91 (PR-1, 2026-08-23): the literal below is the shared
        // NotificationPayloadType — see notification-payload-types.ts
        // for the canonical list. The TypeScript compiler will flag
        // a misspelling at build time.
        const payloadType: NotificationPayloadType = 'KYC_INFO_REQUESTED';
        await OutboxService.emit(OutboxEventTypes.NOTIFICATION_SEND, {
          riderId: riderDbId,
          type: payloadType,
          infoRequest,
        }, 3);
        // PR-ONBOARDING-2026-08-11 (audit 2.7): REQUEST_INFO left no
        // audit trail. Writes `kyc.requested_info` with reviewer id
        // and the info text. Fire-and-forget; failure does not block
        // the state change.
        const previous = await db.kycProfile.findUnique({
          where: { riderId: riderDbId },
          select: { id: true, status: true },
        });
        if (previous) {
          createAuditLog({
            actorId: reviewerId,
            actorType: 'ADMIN',
            action: 'kyc.requested_info',
            entity: 'KycProfile',
            entityId: previous.id,
            details: {
              riderId: riderDbId,
              previousStatus: previous.status,
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
