import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { validateBody, createVehicleSchema, updateVehicleSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { parsePositiveInt } from '@/lib/api-utils';
import { createAuditLog } from '@/lib/audit-log';
import { hasPermission } from '@/lib/auth';
import { getOrSetResponse, invalidateCache } from '@/lib/cache';
import { vehicleUseCases } from '@/server/modules/vehicles/vehicle.use-cases';

function checkVehiclePermission(
  session: any,
  action: 'view' | 'create' | 'update' | 'delete'
): boolean {
  const permMap: Record<string, string> = {
    view: 'vehicles_view',
    create: 'vehicles_create',
    update: 'vehicles_update',
    delete: 'vehicles_delete',
  };
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
    // DEEP-AUDIT D-P1-1: parsePositiveInt clamps to a finite int ≥ 1, so
    // ?page=abc returns 1 instead of NaN (which previously crashed Prisma's
    // skip/take).
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

    const cacheKey = [
      'admin:vehicles',
      session.adminId ?? session.riderDbId ?? 'anon',
      status,
      hubId,
      page,
      limit,
    ].join(':');

    const result = await getOrSetResponse(cacheKey, () =>
      vehicleUseCases.listAdminVehicles({ status, hubId, page, limit }),
      5
    );

    if (!result) return errors.internal('Failed to fetch vehicles');

    return withCacheHeaders(
      success(
        { vehicles: result.vehicles, hubs: result.hubs },
        undefined,
        200,
        result.pagination
      ),
      5
    );
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

    invalidateCache('admin:*');

    await createAuditLog({
      actorId: session.adminId || session.riderDbId || 'system',
      action: 'vehicle.create',
      entity: 'vehicle',
      entityId: vehicle.id,
      details: { vehicleNumber: validation.data.vehicleNumber, vehicleId },
    }).catch(() => {});

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

    invalidateCache('admin:*');

    await createAuditLog({
      actorId: session.adminId || session.riderDbId || 'system',
      action: 'vehicle.update',
      entity: 'vehicle',
      entityId: vehicle.id,
      details: { updatedFields: Object.keys(data) },
    }).catch(() => {});

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

    // P1.7/P3.15: retireVehicle 404s on an unknown id and 409s on an active
    // lease — the old code silently returned 200 with no write for a typo'd id.
    await vehicleUseCases.retireVehicle(id, session.adminId || session.riderDbId || 'system');
    invalidateCache('admin:*');
    invalidateCache('admin:vehicles:*');
    invalidateCache('vehicles_list:*');
    return success(null, 'Vehicle retired');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('VEHICLE_NOT_FOUND')) return errors.notFound('Vehicle not found');
    if (message.includes('VEHICLE_HAS_ACTIVE_LEASE')) {
      return errors.conflict('Vehicle is on an active rental and cannot be retired');
    }
    logger.error('Retire vehicle error:', error);
    return errors.internal('Failed to retire vehicle');
  }
}
