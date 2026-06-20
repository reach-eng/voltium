/**
 * POST /api/rider/kyc — Submit KYC documents
 * GET /api/rider/kyc — Get KYC status
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 * Business logic lives in kycUseCases and kycRepository.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, submitKycSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { kycUseCases } from '@/server/modules/kyc/kyc.use-cases';

export async function POST(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;

    const body = await request.json();
    const validation = validateBody(submitKycSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const result = await kycUseCases.submitKyc(session.riderDbId, validation.data);
    return success(
      {
        id: result.id,
        riderId: result.riderId,
        kycStatus: result.status,
      },
      'KYC submitted successfully'
    );
  } catch (err: any) {
    if (err.name === 'KycStateError') {
      return errors.conflict(err.message);
    }
    logger.error('[POST /api/rider/kyc]', err);
    return errors.internal('Failed to submit KYC');
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;

    const kycProfile = await kycUseCases.getKycStatus(session.riderDbId);

    if (!kycProfile) {
      return success(
        {
          kycStatus: 'PENDING',
          profilePhoto: null,
          riderPhoto: null,
          signature: null,
          aadhaarFront: null,
          aadhaarBack: null,
          panCard: null,
          bankAccount: null,
          bankIfsc: null,
          bankName: null,
        },
        'No KYC profile found'
      );
    }

    return success({
      kycStatus: kycProfile.status,
      profilePhoto: kycProfile.profilePhoto,
      riderPhoto: kycProfile.riderPhoto,
      signature: kycProfile.signature,
      aadhaarFront: kycProfile.aadhaarFront,
      aadhaarBack: kycProfile.aadhaarBack,
      panCard: kycProfile.panCard,
      bankName: kycProfile.bankName,
      rejectionReason: kycProfile.rejectionReason,
    });
  } catch (err) {
    logger.error('[GET /api/rider/kyc]', err);
    return errors.internal('Failed to fetch KYC');
  }
}
