/**
 * KYC module - Routes.
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 */

import { NextRequest } from 'next/server';
import { requireRiderSession } from '@/lib/rider-auth';
import { requirePermission } from '@/lib/rbac';
import { kycUseCases } from './kyc.use-cases';
import { submitKycSchema, reviewKycSchema } from './kyc.schemas';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';

export async function GET_status(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const kyc = await kycUseCases.getKycStatus(session.riderDbId);
  return success(kyc);
}

export async function POST_submit(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const body = await request.json();
  const validation = validateBody(submitKycSchema, body);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const result = await kycUseCases.submitKyc(session.riderDbId, validation.data);
  return success(result, 'KYC submitted successfully');
}

export async function POST_review(request: NextRequest) {
  const admin = await requirePermission('kyc_approve');
  if (!admin) return errors.forbidden('Insufficient permissions');

  const body = await request.json();
  const validation = validateBody(reviewKycSchema, body);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const result = await kycUseCases.reviewKyc(
    validation.data.riderId,
    admin.adminId || admin.riderDbId,
    {
      reviewerId: admin.adminId || admin.riderDbId,
      action: validation.data.action,
      rejectionReason: validation.data.rejectionReason,
      infoRequest: validation.data.infoRequest,
    }
  );
  return success(result, `KYC ${validation.data.action.toLowerCase()}d`);
}
