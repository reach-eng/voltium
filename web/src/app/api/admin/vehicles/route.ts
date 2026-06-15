import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, createVehicleSchema, updateVehicleSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden, parsePaginationParams } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit-log';
import { hasPermission } from '@/lib/auth';
import { vehicleUseCases } from '@/server/modules/vehicles/vehicle.use-cases';

function checkVehiclePermission(session: any, action: 'view' | 'create' | 'update' | 'delete'): boolean {
  const permMap: Record<string, string> = { view: 'vehicles_view', create: 'vehicles_create', update: 'vehicles_update', delete: 'vehicles_delete' };
  return hasPermission(session.adminRole || '', permMap[action] as any);
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkVehiclePermission(session, 'view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status') || '';
    const hubId = url.searchParams.get('hubId') || '';
    const { page, limit } = parsePaginationParams(url);

    const result = await vehicleUseCases.listAdminVehicles({ status, hubId, page, limit });
    return success({ vehicles: result.vehicles, hubs: result.hubs }, undefined, 200, result.pagination);
  } catch (error) {
    logger.error('Vehicles list error:', error);
    return errors.internal('Failed to fetch vehicles');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkVehiclePermission(session, 'create')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(createVehicleSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const existing = await vehicleUseCases.existsByNumber(validation.data.vehicleNumber);
    if (existing) return errors.conflict('Vehicle with this number already exists');

    const vehicleId = await vehicleUseCases.getNextId();

    const vehicle = await vehicleUseCases.createVehicle({
      vehicleNumber: validation.data.vehicleNumber,
      vehicleId,
      model: validation.data.model,
      batteryPartner: validation.data.batteryPartner || null,
      licensePlate: validation.data.licensePlate || null,
      status: validation.data.status || 'AVAILABLE',
      hub: { connect: { id: validation.data.hubId } },
    } as any);

    await createAuditLog({ actorId: session.adminId || session.riderDbId || 'system', action: 'vehicle.create', entity: 'vehicle', entityId: vehicle.id, details: { vehicleNumber: validation.data.vehicleNumber, vehicleId } }).catch(() => {});

    return success(vehicle, 'Vehicle created', 201);
  } catch (error) {
    logger.error('Create vehicle error:', error);
    return errors.internal('Failed to create vehicle');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkVehiclePermission(session, 'update')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(updateVehicleSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const { id, ...data } = validation.data;
    const vehicle = await vehicleUseCases.updateVehicle(id, data);

    await createAuditLog({ actorId: session.adminId || session.riderDbId || 'system', action: 'vehicle.update', entity: 'vehicle', entityId: vehicle.id, details: { updatedFields: Object.keys(data) } }).catch(() => {});

    return success(vehicle);
  } catch (error) {
    logger.error('Update vehicle error:', error);
    return errors.internal('Failed to update vehicle');
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkVehiclePermission(session, 'delete')) return adminForbidden();

  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return errors.badRequest('Vehicle ID is required');

    const vehicle = await vehicleUseCases.getVehicle(id);
    if (vehicle) {
      await vehicleUseCases.updateVehicle(id, { status: 'RETIRED' });
      await createAuditLog({ actorId: session.adminId || session.riderDbId || 'system', action: 'vehicle.delete', entity: 'vehicle', entityId: id, details: { vehicleNumber: vehicle.vehicleNumber, vehicleId: vehicle.vehicleId } }).catch(() => {});
    }

    return success(null, 'Vehicle deleted');
  } catch (error) {
    logger.error('Delete vehicle error:', error);
    return errors.internal('Failed to delete vehicle');
  }
}
