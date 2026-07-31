/**
 * Riders module - Routes.
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 */

import { NextRequest } from 'next/server';
import { requireRiderSession } from '@/lib/rider-auth';
import { riderUseCases } from './rider.use-cases';
import { updateProfileSchema } from './rider.schemas';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';

export async function GET_profile(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const rider = await riderUseCases.getProfile(session.riderDbId);
  return success(rider);
}

export async function PUT_profile(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const body = await request.json();
  const validation = validateBody(updateProfileSchema, body);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const updated = await riderUseCases.updateProfile(session.riderDbId, validation.data);
  return success(updated, 'Profile updated');
}

export async function GET_state(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const state = await riderUseCases.getState(session.riderDbId);
  if (!state) return errors.notFound('Rider state not found');
  return success(state);
}
