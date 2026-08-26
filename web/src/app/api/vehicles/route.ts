import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { vehicleUseCases } from '@/server/modules/vehicles/vehicle.use-cases';
import { getOrSetResponse } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const hubId = request.nextUrl.searchParams.get('hubId');
    if (!hubId) return errors.validation('hubId is required');

    const result = await getOrSetResponse(
      `vehicles_list:${hubId}`,
      () => vehicleUseCases.getVehiclesAtHub(hubId),
      60
    );
    
    return success(result, 'Vehicles fetched successfully');
  } catch (err: unknown) {
    if ((err instanceof Error ? err.message : String(err)) === 'Hub not found') return errors.notFound((err instanceof Error ? err.message : String(err)));
    logger.error('[GET /api/vehicles]', err);
    return errors.internal('Failed to fetch vehicles');
  }
}
