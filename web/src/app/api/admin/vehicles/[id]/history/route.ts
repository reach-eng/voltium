import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { vehicleUseCases } from '@/server/modules/vehicles/vehicle.use-cases';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'vehicles_view')) return adminForbidden();

  try {
    const { id } = await params;
    const data = await vehicleUseCases.getVehicleHistory(id);
    return success(data);
  } catch (error) {
    return errors.internal('Failed to fetch vehicle history');
  }
}
