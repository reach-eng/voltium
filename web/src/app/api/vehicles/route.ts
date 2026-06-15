import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { vehicleUseCases } from '@/server/modules/vehicles/vehicle.use-cases';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const hubId = request.nextUrl.searchParams.get('hubId');
    if (!hubId) return errors.validation('hubId is required');

    const result = await vehicleUseCases.getVehiclesAtHub(hubId);
    return success(result, 'Vehicles fetched successfully');
  } catch (err: any) {
    if (err.message === 'Hub not found') return errors.notFound(err.message);
    logger.error('[GET /api/vehicles]', err);
    return errors.internal('Failed to fetch vehicles');
  }
}
