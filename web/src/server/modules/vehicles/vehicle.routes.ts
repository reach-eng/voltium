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

export async function GET_list(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return errors.unauthorized();

  const { searchParams } = request.nextUrl;
  const query = vehicleQuerySchema.parse(Object.fromEntries(searchParams));
  const vehicles = await vehicleUseCases.listVehicles(query);
  return success(vehicles);
}

export async function POST_create(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return errors.unauthorized();

  const body = await request.json();
  const validation = validateBody(createVehicleSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const vehicle = await vehicleUseCases.createVehicle(validation.data);
  return success(vehicle, 'Vehicle created');
}

export async function PUT_update(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return errors.unauthorized();

  const body = await request.json();
  const validation = validateBody(updateVehicleSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const vehicle = await vehicleUseCases.updateVehicle(validation.data.id, validation.data);
  return success(vehicle, 'Vehicle updated');
}
