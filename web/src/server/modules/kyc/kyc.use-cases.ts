/**
 * KYC module - Use cases.
 *
 * Orchestrates KYC submission, review, and document verification workflows.
 */

import type { KycSubmission, KycReview } from './kyc.types';
import { kycRepository } from './kyc.repository';

export const kycUseCases = {
  async getKycStatus(riderDbId: string) {
    return kycRepository.findByRiderId(riderDbId);
  },

  async submitKyc(riderDbId: string, input: KycSubmission) {
    // Map frontend field names to Prisma model field names
    const prismaData = mapKycFieldsToPrisma(input as any);

    // Progressive upload support:
    // Only transition to SUBMITTED if all critical docs are present
    // Partial uploads just save data and keep current status (DRAFT)
    const existing = await kycRepository.findByRiderId(riderDbId);

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
    switch (review.action) {
      case 'APPROVE':
        return kycRepository.approveKyc(riderDbId, reviewerId);
      case 'REJECT':
        return kycRepository.rejectKyc(riderDbId, reviewerId, review.rejectionReason || '');
      case 'REQUEST_INFO':
        return kycRepository.requestInfo(riderDbId, reviewerId, review.infoRequest || 'Additional information required');
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
