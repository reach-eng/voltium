/**
 * Guarantors module - Use cases.
 *
 * Orchestrates guarantor submission, admin review (approve/reject/request-info),
 * and replacement workflows.
 *
 * State machine rules (enforced by the repository — add pre-condition checks):
 *   DRAFT → SUBMITTED
 *   SUBMITTED → APPROVED | REJECTED | INFO_REQUIRED
 *   INFO_REQUIRED → SUBMITTED (rider resubmits)
 *   REJECTED → REPLACED (rider replaces with a new guarantor → DRAFT)
 *   APPROVED → (terminal — no further transitions)
 *   REPLACED → (terminal — a new record must be started)
 */

import { db } from '@/lib/db';
import { isProductionEnv, isDevelopmentEnv } from '@/lib/env';
import type { GuarantorSubmission, GuarantorReview } from './guarantor.types';
import { guarantorRepository } from './guarantor.repository';
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';
import { ValidationError } from "@/lib/api-error";

const TEST_PHONES = ['9876543210', '9999999999', '8888888888', '7788888801'];

export const guarantorUseCases = {
  async getGuarantorStatus(riderDbId: string) {
    return guarantorRepository.findByRiderId(riderDbId);
  },

  async submitGuarantor(riderDbId: string, input: GuarantorSubmission) {
    if (input.phone) {
      const cleaned = input.phone.replace(/\D/g, '');
      if (cleaned.length < 10) {
        throw new ValidationError('Invalid phone format');
      }
    }

    if (isProductionEnv() && (!input.aadhaarFront || !input.aadhaarBack)) {
      throw new ValidationError('Aadhaar front and back documents are required');
    }

    const current = await guarantorRepository.findByRiderId(riderDbId);
    if (current && current.status === 'REJECTED') {
      await guarantorRepository.replaceGuarantor(riderDbId);
    }

    return guarantorRepository.submitGuarantor(riderDbId, input as any);
  },

  async reviewGuarantor(riderDbId: string, reviewerId: string, review: GuarantorReview) {
    switch (review.action) {
      case 'APPROVE': {
        const result = await guarantorRepository.approveGuarantor(riderDbId, reviewerId);
        const rider = await db.rider.findUnique({ where: { id: riderDbId }, select: { lifecycleStatus: true } });
        if (rider && rider.lifecycleStatus === 'GUARANTOR_SUBMITTED') {
          await transitionRiderStatus(riderDbId, 'GUARANTOR_APPROVED');
        }
        return result;
      }
      case 'REJECT':
        return guarantorRepository.rejectGuarantor(
          riderDbId,
          reviewerId,
          review.rejectionReason || ''
        );
      case 'REQUEST_INFO':
        return guarantorRepository.requestInfo(
          riderDbId,
          reviewerId,
          review.infoRequest || 'Additional information required'
        );
    }
  },

  async replaceGuarantor(riderDbId: string) {
    return guarantorRepository.replaceGuarantor(riderDbId);
  },

  async autoVerifyIfTestMode(riderDbId: string) {
    if (
      !isDevelopmentEnv() ||
      process.env.ENABLE_DEV_TOOLS !== 'true' ||
      process.env.TEST_MODE !== 'true'
    )
      return;
    const rider = await db.rider.findUnique({ where: { id: riderDbId }, select: { phone: true } });
    if (rider && TEST_PHONES.includes(rider.phone)) {
      return guarantorRepository.autoVerifyTestGuarantor(riderDbId);
    }
  },
};
