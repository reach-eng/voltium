/**
 * POST /api/rider/sync/pickup — Complete vehicle pickup
 *
 * Thin route handler: auth + parse + call use-case + respond.
 *
 * PR-26b: routes the request through the new
 * `completePickupVerification` use case (with precondition checks + audit
 * log) instead of calling `rentalUseCases.syncPickup` directly. The
 * use case delegates to syncPickup internally for the actual
 * vehicle-claim + state-transition work.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { completePickupVerification, PickupVerificationError } from '@/server/modules/pickup/use-cases';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const body = await request.json();
    const {
      vehicleId,
      hubId,
      teamLeader,
      emergencyContact,
      pickupPhoto,
      pickupPhotoFront,
      pickupPhotoBack,
      pickupPhotoLeft,
      pickupPhotoRight,
      pickupPhotoWithVehicle,
    } = body;

    if (!vehicleId) return errors.badRequest('Vehicle ID/Number is required');

    const result = await completePickupVerification(riderDbId, {
      vehicleId,
      hubId,
      teamLeader,
      emergencyContact,
      pickupPhotoFront: pickupPhotoFront || pickupPhoto,
      pickupPhotoBack,
      pickupPhotoLeft,
      pickupPhotoRight,
      pickupPhotoWithVehicle,
    });

    logger.info('Vehicle pickup completed', { riderId: riderDbId, vehicleId });
    return success(result, 'Vehicle pickup successful and account activated');
  } catch (err) {
    if (err instanceof PickupVerificationError) {
      switch (err.code) {
        case 'PHOTOS_REQUIRED':
        case 'INVALID_STATE':
        case 'RIDER_NOT_FOUND':
          return errors.badRequest(err.message);
        default:
          return errors.badRequest(err.message);
      }
    }
    if (err instanceof Error && err.message.includes('not found')) {
      return errors.notFound(err.message);
    }
    if (err instanceof Error && err.message.includes('currently')) {
      return errors.conflict(err.message);
    }
    logger.error('Failed to complete vehicle pickup', err);
    return errors.internal('Failed to complete pickup');
  }
}
