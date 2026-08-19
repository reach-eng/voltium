/**
 * GET /api/rider/kyc — Get KYC status
 *
 * KYC documents are submitted via PUT /api/rider/profile (UpdateProfileRequest).
 * The POST /api/rider/kyc route was removed (PR-3, audit 2026-08-05-rider-onboarding)
 * because it had 0 production callers — the Flutter KYC flow uses putRiderProfile.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { kycUseCases } from '@/server/modules/kyc/kyc.use-cases';
import { maskAccountNumber } from '@/lib/pii';

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
      // P1-S3: Mask bank account number in rider-facing KYC response
      bankAccount: maskAccountNumber(kycProfile.accountNumber) || null,
      bankIfsc: kycProfile.ifscCode ?? null,
      rejectionReason: kycProfile.rejectionReason,
    });
  } catch (err) {
    logger.error('[GET /api/rider/kyc]', err);
    return errors.internal('Failed to fetch KYC');
  }
}
