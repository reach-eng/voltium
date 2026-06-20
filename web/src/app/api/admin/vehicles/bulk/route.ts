import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, vehicleBulkActionSchema } from '@/lib/validators';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { vehicleUseCases } from '@/server/modules/vehicles/vehicle.use-cases';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    if (!hasPermission(session.adminRole || '', 'fleet_manage')) return adminForbidden();

    const body = await req.json();
    const validation = validateBody(vehicleBulkActionSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { ids, action, value } = validation.data;
    const result = await vehicleUseCases.bulkUpdateVehicles(
      ids,
      action,
      value,
      session.adminId || ''
    );

    return success(result, 'Bulk action completed');
  } catch (error) {
    if (error instanceof Error && error.message.includes('is required')) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to process bulk action');
  }
}
