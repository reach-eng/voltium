/**
 * KYC module - Repository.
 *
 * Data access for KYC submissions, reviews, and document metadata.
 * All status transitions are validated against the KYC state machine.
 */

import { db } from '@/lib/db';
import { validateKycTransition, KycStateError } from './kyc-state-machine';
import type { KycStatus } from './kyc.types';

export const kycRepository = {
  async findByRiderId(riderDbId: string) {
    return db.kycProfile.findUnique({
      where: { riderId: riderDbId },
    });
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

    return db.kycProfile.upsert({
      where: { riderId: riderDbId },
      create: {
        riderId: riderDbId,
        ...(data as any),
        status: currentStatus,
      },
      update: {
        ...(data as any),
        // Don't change status — let submitKyc handle the transition
      },
    });
  },

  async submitKyc(riderDbId: string, data: Record<string, unknown>) {
    // Read current status to validate transition
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'SUBMITTED');

    return db.kycProfile.upsert({
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

  async approveKyc(riderDbId: string, reviewerId: string) {
    // Read current status to validate transition
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'APPROVED');

    return db.kycProfile.update({
      where: { riderId: riderDbId },
      data: {
        status: 'APPROVED',
      },
    });
  },

  async rejectKyc(riderDbId: string, reviewerId: string, reason: string) {
    // Read current status to validate transition
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'REJECTED');

    return db.kycProfile.update({
      where: { riderId: riderDbId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
      },
    });
  },

  async requestInfo(riderDbId: string, reviewerId: string, infoRequest: string) {
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'INFO_REQUIRED');

    return db.kycProfile.update({
      where: { riderId: riderDbId },
      data: {
        status: 'INFO_REQUIRED',
        rejectionReason: infoRequest,
      },
    });
  },
};
