/**
 * Hubs module - Routes.
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import { hubUseCases } from './hub.use-cases';
import { createHubSchema, updateHubSchema, createTeamLeaderSchema } from './hub.schemas';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';

export async function GET_list() {
  const hubs = await hubUseCases.listHubs();
  return success(hubs);
}

export async function POST_create(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return errors.unauthorized();

  const body = await request.json();
  const validation = validateBody(createHubSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const hub = await hubUseCases.createHub(validation.data, admin.adminId || 'unknown');
  return success(hub, 'Hub created');
}

export async function PUT_update(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return errors.unauthorized();

  const body = await request.json();
  const validation = validateBody(updateHubSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const hub = await hubUseCases.updateHub(validation.data.id || '', validation.data, admin.adminId || 'unknown');
  return success(hub, 'Hub updated');
}

export async function GET_teamLeaders() {
  const teamLeaders = await hubUseCases.listTeamLeaders();
  return success(teamLeaders);
}

export async function POST_createTeamLeader(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return errors.unauthorized();

  const body = await request.json();
  const validation = validateBody(createTeamLeaderSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const tl = await hubUseCases.createTeamLeader(validation.data);
  return success(tl, 'Team leader created');
}
