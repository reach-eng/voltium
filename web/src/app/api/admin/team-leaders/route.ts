import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors } from '@/lib/api-response';
import { validateBody, createTeamLeaderSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { teamLeaderUseCases } from '@/server/modules/team-leaders/team-leader.use-cases';

const deleteTeamLeaderSchema = z.object({
  id: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'tl_manage')) return adminForbidden();

  try {
    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');

    const result = await teamLeaderUseCases.list({ search, isActive, page, limit });
    return success(result);
  } catch (error) {
    logger.error('GET /api/admin/team-leaders error:', error);
    return errors.internal('Failed to fetch team leaders');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'tl_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(createTeamLeaderSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const teamLeader = await teamLeaderUseCases.create(validation.data, session.adminId || '');
    return success(teamLeader, 'Team leader created', 201);
  } catch (error) {
    logger.error('POST /api/admin/team-leaders error:', error);
    return errors.internal('Failed to create team leader');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'tl_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(
      createTeamLeaderSchema.partial().extend({ id: z.string().min(1) }),
      body,
    );
    if (!validation.success) return errors.validation(validation.error!);

    const { id, ...data } = validation.data;
    const teamLeader = await teamLeaderUseCases.update(id, data, session.adminId || '');
    return success(teamLeader);
  } catch (error) {
    logger.error('PUT /api/admin/team-leaders error:', error);
    return errors.internal('Failed to update team leader');
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'tl_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(deleteTeamLeaderSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    await teamLeaderUseCases.delete(validation.data.id, session.adminId || '');
    return success(null, 'Team leader deleted');
  } catch (error) {
    logger.error('DELETE /api/admin/team-leaders error:', error);
    return errors.internal('Failed to delete team leader');
  }
}
