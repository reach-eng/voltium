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
import { syncPickup } from '@/server/modules/rentals/use-cases/sync-pickup.use-case';
import { isProductionEnv } from '@/lib/env';

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
      startOdometer,
      odometer,
      startBatteryPct,
      batteryPct,
    } = body;

    if (!vehicleId) return errors.badRequest('Vehicle ID/Number is required');

    const frontPhoto = pickupPhotoFront || pickupPhoto;
    if (isProductionEnv() && !frontPhoto) {
      return errors.badRequest('At least one vehicle condition photo (Front) is required for pickup');
    }

    const parsedOdometer = typeof startOdometer === 'number' ? startOdometer : typeof odometer === 'number' ? odometer : undefined;
    const parsedBattery = typeof startBatteryPct === 'number' ? startBatteryPct : typeof batteryPct === 'number' ? batteryPct : undefined;

    const result = await syncPickup(riderDbId, {
      vehicleId,
      hubId,
      teamLeader,
      emergencyContact,
      pickupPhotoFront: frontPhoto,
      pickupPhotoBack,
      pickupPhotoLeft,
      pickupPhotoRight,
      pickupPhotoWithVehicle,
      startOdometer: parsedOdometer,
      startBatteryPct: parsedBattery,
    });

    logger.info('Vehicle pickup completed', { riderId: riderDbId, vehicleId });
    return success(result, 'Vehicle pickup successful and account activated');
  } catch (err) {
    if (err instanceof Error && (err instanceof Error ? err.message : String(err)).includes('not found')) {
      return errors.notFound((err instanceof Error ? err.message : String(err)));
    }
    if (err instanceof Error && (err instanceof Error ? err.message : String(err)).includes('currently')) {
      return errors.conflict((err instanceof Error ? err.message : String(err)));
    }
    logger.error('Failed to complete vehicle pickup', err);
    return errors.internal('Failed to complete pickup');
  }
}
