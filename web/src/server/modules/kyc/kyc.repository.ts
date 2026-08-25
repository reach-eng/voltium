/**
 * KYC module - Repository.
 *
 * Data access for KYC submissions, reviews, and document metadata.
 * All status transitions are validated against the KYC state machine.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { validateKycTransition, KycStateError } from './kyc-state-machine';
import type { KycStatus } from './kyc.types';
import { encryptPii, decryptPii } from '@/lib/pii-crypto';
import { invalidateRiderCache } from '@/lib/server-cache';
import { logKycDocumentView } from '@/lib/security-events';

function encryptKycData(data: Record<string, unknown> | null) {
  if (!data) return data;
  const result = { ...data };
  if (result.aadhaarNumber !== undefined) result.aadhaarNumber = encryptPii(String(result.aadhaarNumber));
  if (result.panNumber !== undefined) result.panNumber = encryptPii(String(result.panNumber));
  if (result.accountNumber !== undefined) result.accountNumber = encryptPii(String(result.accountNumber));
  if (result.ifscCode !== undefined) result.ifscCode = encryptPii(String(result.ifscCode));
  return result;
}

function decryptKycData<T>(data: T): T {
  if (!data) return data;
  const result = { ...(data as Record<string, unknown>) };
  if (result.aadhaarNumber !== undefined) result.aadhaarNumber = decryptPii(String(result.aadhaarNumber));
  if (result.panNumber !== undefined) result.panNumber = decryptPii(String(result.panNumber));
  if (result.accountNumber !== undefined) result.accountNumber = decryptPii(String(result.accountNumber));
  if (result.ifscCode !== undefined) result.ifscCode = decryptPii(String(result.ifscCode));
  return result as T;
}

export const kycRepository = {
  async findByRiderId(riderDbId: string) {
    const kyc = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
    });
    return decryptKycData(kyc);
  },

  /**
   * Admin-context variant of findByRiderId. Fires the security-event
   * logger (logKycDocumentView) so every admin document access is
   * recorded in the audit log (SOC2 requirement).
   *
   * Use this from admin routes that show KYC documents to admins.
   * Use the plain findByRiderId for the rider's own self-service path.
   */
  async findByRiderIdForAdmin(riderDbId: string, adminContext: { adminId: string }) {
    const kyc = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
    });

    // Fire-and-forget audit log. Don't block the response on the write.
    if (kyc) {
      void logKycDocumentView({
        adminId: adminContext.adminId,
        riderId: riderDbId,
        documentType: 'full_profile',
      });
    }

    return decryptKycData(kyc);
  },

  async findMany(args: Prisma.KycProfileFindManyArgs) {
    const records = await db.kycProfile.findMany(args);
    return records.map(decryptKycData);
  },

  async count(args: Prisma.KycProfileCountArgs) {
    return db.kycProfile.count(args);
  },

  /**
   * Saves KYC data without changing status — used for progressive uploads.
   * Does NOT trigger state machine validation since status is preserved.
   */
  async savePartialKyc(riderDbId: string, data: Record<string, unknown>) {
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    // Preserve current status (don't transition to SUBMITTED)
    const currentStatus = existing?.status || 'DRAFT';
    const encryptedData = encryptKycData(data);

    const kyc = await db.kycProfile.upsert({
      where: { riderId: riderDbId },
      create: {
        ...(encryptedData as unknown as Prisma.KycProfileUncheckedCreateInput),
        riderId: riderDbId,
        status: currentStatus,
      },
      update: {
        ...(encryptedData as unknown as Prisma.KycProfileUncheckedUpdateInput),
        // Don't change status — let submitKyc handle the transition
      },
    });
    invalidateRiderCache(riderDbId);
    return decryptKycData(kyc);
  },

  async submitKyc(riderDbId: string, data: Record<string, unknown>) {
    // Read current status to validate transition
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    if (currentStatus === 'APPROVED' || currentStatus === 'EXPIRED') {
      throw new KycStateError(
        `Cannot resubmit KYC documents from status "${currentStatus}"`,
        currentStatus,
        'SUBMITTED'
      );
    }
    validateKycTransition(currentStatus, 'SUBMITTED');

    const encryptedData = encryptKycData(data);

    return db.$transaction(async (tx) => {
      const kyc = await tx.kycProfile.upsert({
        where: { riderId: riderDbId },
        create: {
          ...(encryptedData as unknown as Prisma.KycProfileUncheckedCreateInput),
          riderId: riderDbId,
          status: 'SUBMITTED',
        },
        update: {
          ...(encryptedData as unknown as Prisma.KycProfileUncheckedUpdateInput),
          status: 'SUBMITTED',
        },
      });

      await tx.rider.updateMany({
        where: {
          id: riderDbId,
          lifecycleStatus: { in: ['NEW', 'PHONE_VERIFIED', 'PROFILE_SUBMITTED'] },
        },
        data: { lifecycleStatus: 'KYC_SUBMITTED', kycDoneAt: new Date() },
      });

      invalidateRiderCache(riderDbId);
      return decryptKycData(kyc);
    });
  },

  async approveKyc(riderDbId: string, reviewerId: string) {
    // Read current status to validate transition
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'APPROVED');

    return db.$transaction(async (tx) => {
      const claimResult = await tx.kycProfile.updateMany({
        where: { riderId: riderDbId, status: currentStatus },
        data: { status: 'APPROVED' },
      });
      if (claimResult.count === 0) {
        throw new KycStateError(
          `Concurrent decision race: KYC profile for rider ${riderDbId} is no longer in status "${currentStatus}"`,
          currentStatus,
          'APPROVED'
        );
      }
      const kyc = await tx.kycProfile.findUniqueOrThrow({ where: { riderId: riderDbId } });
      await tx.rider.update({
        where: { id: riderDbId },
        data: { kycDoneAt: new Date() },
      });
      await tx.rider.updateMany({
        where: { 
          id: riderDbId, 
          lifecycleStatus: { 
            in: [
              'NEW', 'PHONE_VERIFIED', 'PROFILE_SUBMITTED', 
              'GUARANTOR_SUBMITTED', 'GUARANTOR_APPROVED', 
              'PLAN_SELECTED', 'DEPOSIT_PENDING', 
              'DEPOSIT_APPROVED', 'KYC_SUBMITTED'
            ] 
          } 
        },
        data: { lifecycleStatus: 'KYC_APPROVED' },
      });

      invalidateRiderCache(riderDbId);

      // BLOCKER 2.7: notification is dispatched by the outbox worker
      // (kyc.use-cases.ts emits NOTIFICATION_SEND inside the same
      // transaction). The repository no longer fires a duplicate
      // notificationService.notifyKycStatusChange call.
      //
      // The use-case's emit() is committed atomically with the KYC
      // approval, and notificationDispatchJob (Phase 1.4) handles
      // the actual delivery with retry/backoff.

      return kyc;
    });
  },

  async rejectKyc(riderDbId: string, reviewerId: string, reason: string, editableFields: string[] = []) {
    // Read current status to validate transition
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'REJECTED');

    return db.$transaction(async (tx) => {
      const claimResult = await tx.kycProfile.updateMany({
        where: { riderId: riderDbId, status: currentStatus },
        data: { status: 'REJECTED', rejectionReason: reason, editableFields },
      });
      if (claimResult.count === 0) {
        throw new KycStateError(
          `Concurrent decision race: KYC profile for rider ${riderDbId} is no longer in status "${currentStatus}"`,
          currentStatus,
          'REJECTED'
        );
      }
      const kyc = await tx.kycProfile.findUniqueOrThrow({ where: { riderId: riderDbId } });
      await tx.rider.updateMany({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'SUSPENDED' },
      });

      invalidateRiderCache(riderDbId);

      // BLOCKER 2.7: notification is dispatched by the outbox worker.
      // See the comment on approveKyc above.

      return kyc;
    });
  },

  async requestInfo(riderDbId: string, reviewerId: string, infoRequest: string) {
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'INFO_REQUIRED');

    return db.$transaction(async (tx) => {
      const claimResult = await tx.kycProfile.updateMany({
        where: { riderId: riderDbId, status: currentStatus },
        data: {
          status: 'INFO_REQUIRED',
          rejectionReason: infoRequest,
        },
      });
      if (claimResult.count === 0) {
        throw new KycStateError(
          `Concurrent decision race: KYC profile for rider ${riderDbId} is no longer in status "${currentStatus}"`,
          currentStatus,
          'INFO_REQUIRED'
        );
      }
      const kyc = await tx.kycProfile.findUniqueOrThrow({ where: { riderId: riderDbId } });
      invalidateRiderCache(riderDbId);
      return kyc;
    });
  },
};
