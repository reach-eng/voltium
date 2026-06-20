/**
 * POST /api/rider/sync/pickup — Complete vehicle pickup
 *
 * Thin route handler: auth + parse + call use-case + respond.
 * Business logic (vehicle resolution, rider state transition, asset handover) lives in rentalUseCases.syncPickup.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { flattenRider } from '@/lib/flatten-rider';
import { requireRiderSession } from '@/lib/rider-auth';
import { rentalUseCases } from '@/server/modules/rentals/rental.use-cases';

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

    const result = await rentalUseCases.syncPickup(riderDbId, {
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
