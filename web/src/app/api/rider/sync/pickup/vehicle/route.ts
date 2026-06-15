import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { vehicleUseCases } from '@/server/modules/vehicles/vehicle.use-cases';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const { searchParams } = request.nextUrl;
    const query = searchParams.get('query') || '';
    const hubId = searchParams.get('hubId') || '';

    if (!query) {
      return errors.badRequest('Vehicle ID/Number is required');
    }

    const vehicle = await vehicleUseCases.verifyPickupVehicle(query, hubId);
    return success({
      id: vehicle.id,
      vehicleId: vehicle.vehicleId,
      vehicleNumber: vehicle.vehicleNumber,
      model: vehicle.model,
      status: vehicle.status,
      hubId: vehicle.hub.id,
      hubName: vehicle.hub.name,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Vehicle not found at this hub') {
      return errors.notFound('Vehicle not found at this hub');
    }
    return errors.internal('Failed to verify vehicle');
  }
}
