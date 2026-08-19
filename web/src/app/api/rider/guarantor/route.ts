/**
 * GET /api/rider/guarantor — Get guarantor status
 *
 * Guarantor data is submitted via PUT /api/rider/profile (UpdateProfileRequest
 * guarantorXxx fields). The POST /api/rider/guarantor route was removed
 * (PR-3, audit 2026-08-05-rider-onboarding) because it had 0 production callers.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { guarantorUseCases } from '@/server/modules/guarantors/guarantor.use-cases';

export async function GET(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;

    const result = await guarantorUseCases.getGuarantorStatus(session.riderDbId);

    if (!result) {
      return success(
        {
          guarantorStatus: 'PENDING',
          name: null,
          relation: null,
          dob: null,
          phone: null,
        },
        'No guarantor profile found'
      );
    }

    return success({
      guarantorStatus: result.status,
      name: result.name,
      relation: result.relation,
      dob: result.dob,
      phone: result.phone,
      fatherName: result.fatherName,
      motherName: result.motherName,
      address: result.address,
      aadhaarFront: result.aadhaarFront,
      aadhaarBack: result.aadhaarBack,
      pan: result.pan,
      video: result.video,
      signature: result.signature,
      photo: result.photo,
      rejectionReason: 'rejectionReason' in result ? (result as { rejectionReason: string | null }).rejectionReason : null,
    });
  } catch (err) {
    logger.error('[GET /api/rider/guarantor]', err);
    return errors.internal('Failed to fetch guarantor');
  }
}
