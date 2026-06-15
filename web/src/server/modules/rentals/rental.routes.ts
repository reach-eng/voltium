/**
 * Rentals module - Routes.
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 */

import { NextRequest } from 'next/server';
import { requireRiderSession } from '@/lib/rider-auth';
import { requirePermission } from '@/lib/rbac';
import { rentalUseCases } from './rental.use-cases';
import { subscribePlanSchema, startRentalSchema, endRentalSchema } from './rental.schemas';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';

export async function GET_plans() {
  const plans = await rentalUseCases.getPlans();
  return success(plans);
}

export async function POST_selectPlan(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const body = await request.json();
  const validation = validateBody(subscribePlanSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const result = await rentalUseCases.selectPlan(session.riderDbId, validation.data.planId);
  return success(result, 'Plan selected');
}

export async function GET_active(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const rental = await rentalUseCases.getActiveRental(session.riderDbId);
  return success(rental);
}

export async function POST_startRental(request: NextRequest) {
  const admin = await requirePermission('hubs_manage');
  if (!admin) return errors.forbidden('Insufficient permissions');

  const body = await request.json();
  const validation = validateBody(startRentalSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const result = await rentalUseCases.startRental(
    validation.data.riderId,
    validation.data.vehicleId,
    validation.data.hubId,
    validation.data.teamLeader
  );
  return success(result, 'Rental started');
}

export async function POST_requestReturn(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const body = await request.json();
  const validation = validateBody(endRentalSchema, { ...body, riderId: session.riderDbId });
  if (!validation.success) return errors.validation(validation.error);

  const result = await rentalUseCases.requestReturn(
    session.riderDbId,
    validation.data.returnPhotos,
    validation.data.returnReason
  );
  return success(result, 'Return requested');
}
