/**
 * Guarantors module - Routes.
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 */

import { NextRequest } from 'next/server';
import { requireRiderSession } from '@/lib/rider-auth';
import { requirePermission } from '@/lib/rbac';
import { guarantorUseCases } from './guarantor.use-cases';
import { submitGuarantorSchema, reviewGuarantorSchema } from './guarantor.schemas';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';

export async function GET_status(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const guarantor = await guarantorUseCases.getGuarantorStatus(session.riderDbId);
  return success(guarantor);
}

export async function POST_submit(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const body = await request.json();
  const validation = validateBody(submitGuarantorSchema, {
    ...body,
    riderId: session.riderDbId,
  });
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const result = await guarantorUseCases.submitGuarantor(session.riderDbId, validation.data);
  return success(result, 'Guarantor submitted successfully');
}

export async function POST_review(request: NextRequest) {
  const admin = await requirePermission('kyc_approve');
  if (!admin) return errors.forbidden('Insufficient permissions');

  const body = await request.json();
  const validation = validateBody(reviewGuarantorSchema, body);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const result = await guarantorUseCases.reviewGuarantor(
    validation.data.riderId,
    admin.adminId || admin.riderDbId || 'unknown',
    {
      ...validation.data,
      reviewerId: admin.adminId || admin.riderDbId || 'unknown',
    }
  );
  return success(result, `Guarantor ${validation.data.action.toLowerCase()}d`);
}

export async function POST_replace(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const result = await guarantorUseCases.replaceGuarantor(session.riderDbId);
  return success(result, 'Guarantor marked for replacement');
}
