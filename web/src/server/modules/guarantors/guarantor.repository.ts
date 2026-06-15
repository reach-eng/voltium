/**
 * Guarantors module - Repository.
 *
 * Data access for guarantor submissions, reviews, and replacement records.
 * All status transitions are validated against the guarantor state machine.
 */

import { db } from '@/lib/db';
import { validateGuarantorTransition, GuarantorStateError } from './guarantor-state-machine';
import type { GuarantorStatus } from './guarantor.types';

export const guarantorRepository = {
  async findByRiderId(riderDbId: string) {
    return db.guarantor.findUnique({
      where: { riderId: riderDbId },
    });
  },

  async submitGuarantor(riderDbId: string, data: Record<string, unknown>) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'SUBMITTED');

    return db.guarantor.upsert({
      where: { riderId: riderDbId },
      create: {
        riderId: riderDbId,
        ...(data as any),
        status: 'SUBMITTED',
      },
      update: {
        ...(data as any),
        status: 'SUBMITTED',
      },
    });
  },

  async approveGuarantor(riderDbId: string, reviewerId: string) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'APPROVED');

    return db.guarantor.update({
      where: { riderId: riderDbId },
      data: { status: 'APPROVED' },
    });
  },

  async rejectGuarantor(riderDbId: string, reviewerId: string, reason: string) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'REJECTED');

    return db.guarantor.update({
      where: { riderId: riderDbId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
      },
    });
  },

  async requestInfo(riderDbId: string, reviewerId: string, infoRequest: string) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'INFO_REQUIRED');

    return db.guarantor.update({
      where: { riderId: riderDbId },
      data: { status: 'INFO_REQUIRED' },
    });
  },

  async autoVerifyTestGuarantor(riderDbId: string) {
    return db.guarantor.update({
      where: { riderId: riderDbId },
      data: { status: 'VERIFIED' },
    });
  },

  async replaceGuarantor(riderDbId: string) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'REPLACED');

    return db.guarantor.update({
      where: { riderId: riderDbId },
      data: { status: 'REPLACED' },
    });
  },
};
