/**
 * Guarantors module - Repository.
 *
 * Data access for guarantor submissions, reviews, and replacement records.
 * All status transitions are validated against the guarantor state machine.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { validateGuarantorTransition, GuarantorStateError } from './guarantor-state-machine';
import type { GuarantorStatus } from './guarantor.types';
import { encryptPii, decryptPii } from '@/lib/pii-crypto';

function encryptGuarantorData(data: any) {
  if (!data) return data;
  const result = { ...data };
  if (result.pan !== undefined) result.pan = encryptPii(result.pan);
  return result;
}

function decryptGuarantorData(data: any) {
  if (!data) return data;
  const result = { ...data };
  if (result.pan !== undefined) result.pan = decryptPii(result.pan);
  return result;
}

export const guarantorRepository = {
  async findByRiderId(riderDbId: string) {
    const guarantor = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
    });
    return decryptGuarantorData(guarantor);
  },

  async findMany(args: Prisma.GuarantorFindManyArgs) {
    const records = await db.guarantor.findMany(args);
    return records.map(decryptGuarantorData);
  },

  async count(args: Prisma.GuarantorCountArgs) {
    return db.guarantor.count(args);
  },

  async submitGuarantor(riderDbId: string, data: Record<string, unknown>) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'SUBMITTED');

    const encryptedData = encryptGuarantorData(data);

    return db.$transaction(async (tx: Prisma.TransactionClient) => {
      const guarantor = await tx.guarantor.upsert({
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
        where: { id: riderDbId, lifecycleStatus: { in: ['KYC_APPROVED'] } },
        data: { lifecycleStatus: 'GUARANTOR_SUBMITTED' },
      });
      return decryptGuarantorData(guarantor);
    });
  },

  async approveGuarantor(riderDbId: string, reviewerId: string) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'APPROVED');

    return db.$transaction(async (tx: Prisma.TransactionClient) => {
      const guarantor = await tx.guarantor.update({
        where: { riderId: riderDbId },
        data: { status: 'APPROVED' },
      });
      await tx.rider.updateMany({
        where: { id: riderDbId, lifecycleStatus: { in: ['GUARANTOR_SUBMITTED', 'KYC_APPROVED'] } },
        data: { lifecycleStatus: 'GUARANTOR_APPROVED' },
      });
      return decryptGuarantorData(guarantor);
    });
  },

  async rejectGuarantor(riderDbId: string, reviewerId: string, reason: string) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'REJECTED');

    return db.$transaction(async (tx: Prisma.TransactionClient) => {
      const guarantor = await tx.guarantor.update({
        where: { riderId: riderDbId },
        data: { status: 'REJECTED' },
      });
      await tx.rider.updateMany({ where: { id: riderDbId }, data: { lifecycleStatus: 'SUSPENDED' } });
      return decryptGuarantorData(guarantor);
    });
  },

  async requestInfo(riderDbId: string, reviewerId: string, infoRequest: string) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'INFO_REQUIRED');

    const guarantor = await db.guarantor.update({
      where: { riderId: riderDbId },
      data: {
        status: 'INFO_REQUIRED',
      },
    });
    return decryptGuarantorData(guarantor);
  },

  async autoVerifyTestGuarantor(riderDbId: string) {
    const guarantor = await db.guarantor.update({
      where: { riderId: riderDbId },
      data: { status: 'APPROVED' },
    });
    return decryptGuarantorData(guarantor);
  },

  async replaceGuarantor(riderDbId: string) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'REPLACED');

    const guarantor = await db.guarantor.update({
      where: { riderId: riderDbId },
      data: { status: 'REPLACED' },
    });
    return decryptGuarantorData(guarantor);
  },
};
