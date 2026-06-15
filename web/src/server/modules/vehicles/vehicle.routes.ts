/**
 * Vehicles module - Routes.
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import { vehicleUseCases } from './vehicle.use-cases';
import { createVehicleSchema, updateVehicleSchema, vehicleQuerySchema } from './vehicle.schemas';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';

import { VehicleStatus } from '@prisma/client';

export async function GET_list(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return errors.unauthorized();

  const { searchParams } = request.nextUrl;
  const query = vehicleQuerySchema.parse(Object.fromEntries(searchParams));
  const vehicles = await vehicleUseCases.listVehicles({
    hubId: query.hubId,
    status: query.status ? (query.status as VehicleStatus) : undefined,
  });
  return success(vehicles);
}

export async function POST_create(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return errors.unauthorized();

  const body = await request.json();
  const validation = validateBody(createVehicleSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const vehicle = await vehicleUseCases.createVehicle({
    vehicleId: `V-${Date.now()}`,
    vehicleNumber: validation.data.vehicleNumber,
    model: validation.data.model,
    batteryPartner: validation.data.batteryPartner || null,
    licensePlate: validation.data.licensePlate || null,
    status: (validation.data.status as VehicleStatus) || undefined,
    hub: {
      connect: { id: validation.data.hubId },
    },
  });
  return success(vehicle, 'Vehicle created');
}

export async function PUT_update(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return errors.unauthorized();

  const body = await request.json();
  const validation = validateBody(updateVehicleSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const updateData: any = {};
  if (validation.data.vehicleNumber) updateData.vehicleNumber = validation.data.vehicleNumber;
  if (validation.data.model) updateData.model = validation.data.model;
  if (validation.data.batteryPartner !== undefined) updateData.batteryPartner = validation.data.batteryPartner;
  if (validation.data.licensePlate !== undefined) updateData.licensePlate = validation.data.licensePlate;
  if (validation.data.hubId) updateData.hubId = validation.data.hubId;
  if (validation.data.status) updateData.status = validation.data.status as VehicleStatus;

  const vehicle = await vehicleUseCases.updateVehicle(validation.data.id, updateData);
  return success(vehicle, 'Vehicle updated');
}
