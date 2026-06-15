/**
 * GET  /api/rider/profile — Get rider profile with all relations
 * PUT  /api/rider/profile — Update rider profile (core, KYC, guarantor fields)
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 * Business logic lives in riderUseCases (profile update, field-level security).
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, updateProfileSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { RiderStateError } from '@/server/modules/riders/rider-lifecycle.service';

export const dynamic = 'force-dynamic';

// GET /api/rider/profile
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const rider = await riderUseCases.getProfile(riderDbId);
    if (!rider) return errors.notFound('Rider not found');

    return success(rider, 'Profile fetched');
  } catch (err) {
    logger.error('[GET /api/rider/profile]', err);
    return errors.internal('Failed to fetch profile');
  }
}

// PUT /api/rider/profile — Update rider profile (core, KYC, or guarantor fields)
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const body = await request.json();
    const validation = validateBody(updateProfileSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { riderId: bodyRiderId, ...updateData } = validation.data;
    if (bodyRiderId && riderDbId !== bodyRiderId) {
      return errors.forbidden("Cannot update another rider's profile");
    }

    const result = await riderUseCases.updateProfile(riderDbId, updateData);
    return success(result, 'Profile updated');
  } catch (err) {
    if (err instanceof RiderStateError) return errors.conflict(err.message);
    logger.error('[PUT /api/rider/profile]', err);
    return errors.internal('Failed to update profile');
  }
}
