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

function encryptKycData(data: any) {
  if (!data) return data;
  const result = { ...data };
  if (result.aadhaarNumber !== undefined) result.aadhaarNumber = encryptPii(result.aadhaarNumber);
  if (result.panNumber !== undefined) result.panNumber = encryptPii(result.panNumber);
  if (result.accountNumber !== undefined) result.accountNumber = encryptPii(result.accountNumber);
  if (result.ifscCode !== undefined) result.ifscCode = encryptPii(result.ifscCode);
  return result;
}

function decryptKycData(data: any) {
  if (!data) return data;
  const result = { ...data };
  if (result.aadhaarNumber !== undefined) result.aadhaarNumber = decryptPii(result.aadhaarNumber);
  if (result.panNumber !== undefined) result.panNumber = decryptPii(result.panNumber);
  if (result.accountNumber !== undefined) result.accountNumber = decryptPii(result.accountNumber);
  if (result.ifscCode !== undefined) result.ifscCode = decryptPii(result.ifscCode);
  return result;
}

export const kycRepository = {
  async findByRiderId(riderDbId: string) {
    const kyc = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
    });
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
        riderId: riderDbId,
        ...(encryptedData as any),
        status: currentStatus,
      },
      update: {
        ...(encryptedData as any),
        // Don't change status — let submitKyc handle the transition
      },
    });
    return decryptKycData(kyc);
  },

  async submitKyc(riderDbId: string, data: Record<string, unknown>) {
    // Read current status to validate transition
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'SUBMITTED');

    const encryptedData = encryptKycData(data);

    return db.$transaction(async (tx: Prisma.TransactionClient) => {
      const kyc = await tx.kycProfile.upsert({
        where: { riderId: riderDbId },
        create: {
          riderId: riderDbId,
          ...(encryptedData as any),
          status: 'SUBMITTED',
        },
        update: {
          ...(encryptedData as any),
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

      return decryptKycData(kyc);
    });
  },

  async approveKyc(riderDbId: string, reviewerId: string) {
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'APPROVED');

    return db.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.kycProfile.updateMany({
        where: { riderId: riderDbId, status: currentStatus },
        data: { status: 'APPROVED' },
      });

      if (updated.count === 0) {
        throw new KycStateError(`KYC profile state changed concurrently from ${currentStatus}`, currentStatus, 'APPROVED');
      }

      const kyc = await tx.kycProfile.findUnique({ where: { riderId: riderDbId } });
      await tx.rider.updateMany({
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

      return decryptKycData(kyc);
    });
  },

  async rejectKyc(riderDbId: string, reviewerId: string, reason: string, editableFields: string[] = []) {
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'REJECTED');

    return db.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.kycProfile.updateMany({
        where: { riderId: riderDbId, status: currentStatus },
        data: { status: 'REJECTED', rejectionReason: reason, editableFields },
      });

      if (updated.count === 0) {
        throw new KycStateError(`KYC profile state changed concurrently from ${currentStatus}`, currentStatus, 'REJECTED');
      }

      const kyc = await tx.kycProfile.findUnique({ where: { riderId: riderDbId } });
      await tx.rider.updateMany({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'SUSPENDED' },
      });

      return decryptKycData(kyc);
    });
  },

  async requestInfo(riderDbId: string, reviewerId: string, infoRequest: string) {
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'INFO_REQUIRED');

    return db.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.kycProfile.updateMany({
        where: { riderId: riderDbId, status: currentStatus },
        data: {
          status: 'INFO_REQUIRED',
          rejectionReason: infoRequest,
        },
      });

      if (updated.count === 0) {
        throw new KycStateError(`KYC profile state changed concurrently from ${currentStatus}`, currentStatus, 'INFO_REQUIRED');
      }

      const kyc = await tx.kycProfile.findUnique({ where: { riderId: riderDbId } });
      return decryptKycData(kyc);
    });
  },
};
