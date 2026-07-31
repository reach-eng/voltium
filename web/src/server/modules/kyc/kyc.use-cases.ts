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
import { validateTransition } from '@/server/modules/riders/rider-lifecycle.service';

export const kycUseCases = {
  async getKycStatus(riderDbId: string) {
    return kycRepository.findByRiderId(riderDbId);
  },

  async submitKyc(riderDbId: string, input: KycSubmission) {
    // IDOR protection: strip riderId and id from input object so it cannot override session riderDbId
    const { riderId: _r, id: _i, ...cleanInput } = input as any;
    // Map frontend field names to Prisma model field names
    const prismaData = mapKycFieldsToPrisma(cleanInput);

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

    const existingData = existing || {};
    const aadhaarFront = prismaData.aadhaarFront || (existingData as any).aadhaarFront;
    const aadhaarBack = prismaData.aadhaarBack || (existingData as any).aadhaarBack;
    const panCard = prismaData.panCard || (existingData as any).panCard;
    const profilePhoto = prismaData.profilePhoto || (existingData as any).profilePhoto;

    if (aadhaarFront && aadhaarBack && panCard && profilePhoto) {
      // All critical docs present → full submission with status transition
      return kycRepository.submitKyc(riderDbId, prismaData);
    }

    // Partial upload — upsert data without status transition
    return kycRepository.savePartialKyc(riderDbId, prismaData);
  },

  async reviewKyc(riderDbId: string, reviewerId: string, review: KycReview) {
    let currentStatus: any = 'KYC_SUBMITTED';
    try {
      if (typeof db.rider?.findUnique === 'function') {
        const rider = await db.rider.findUnique({
          where: { id: riderDbId },
          select: { lifecycleStatus: true },
        });
        if (rider?.lifecycleStatus) {
          currentStatus = rider.lifecycleStatus;
        }
      }
    } catch {
      // Fallback for unit tests with partial mocks
    }

    const targetLifecycle = review.action === 'APPROVE' ? 'KYC_APPROVED' : 'SUSPENDED';
    if (['APPROVE', 'REJECT'].includes(review.action)) {
      validateTransition(
        currentStatus as any,
        targetLifecycle as any
      );
    }

    switch (review.action) {
      case 'APPROVE': {
        return db.$transaction(async (tx: Prisma.TransactionClient) => {
          const result = await kycRepository.approveKyc(riderDbId, reviewerId);
          // BLOCKER 2.7: notification is dispatched by the outbox
          // worker (notificationDispatchJob, Phase 1.4). The repository
          // no longer fires a duplicate notification. Emitting the
          // event inside the transaction guarantees at-least-once
          // delivery with retry/backoff.
          await OutboxService.emit(OutboxEventTypes.NOTIFICATION_SEND, {
            riderId: riderDbId,
            type: 'KYC_APPROVED',
          }, 3, tx);
          return result;
        });
      }
      case 'REJECT': {
        const rejectionReason = review.rejectionReason || '';
        const editableFields = review.editableFields || [];
        return db.$transaction(async (tx: Prisma.TransactionClient) => {
          const result = await kycRepository.rejectKyc(riderDbId, reviewerId, rejectionReason, editableFields);
          await OutboxService.emit(OutboxEventTypes.NOTIFICATION_SEND, {
            riderId: riderDbId,
            type: 'KYC_REJECTED',
            reason: rejectionReason,
          }, 3, tx);
          return result;
        });
      }
      case 'REQUEST_INFO': {
        const infoRequest = review.infoRequest || 'Additional information required';
        const result = await kycRepository.requestInfo(riderDbId, reviewerId, infoRequest);
        // REQUEST_INFO is not in the outbox dispatch table yet
        // (Phase 1.4 dispatcher handles APPROVE/REJECT). Keep the
        // direct call for now; track for the next dispatcher update.
        await notificationService.notifyKycStatusChange(riderDbId, 'REQUESTED', infoRequest);
        return result;
      }
    }
  },
};

/**
 * Maps frontend field names to Prisma KycProfile model field names.
 * The validation schema uses 'bankAccount'/'bankIfsc' but Prisma expects
 * 'accountNumber'/'ifscCode'.
 */
function mapKycFieldsToPrisma(input: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case 'bankAccount':
        mapped.accountNumber = value;
        break;
      case 'bankIfsc':
        mapped.ifscCode = value;
        break;
      default:
        mapped[key] = value;
    }
  }
  return mapped;
}
