import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors } from '@/lib/api-response';
import { validateBody, createHubSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden, parsePaginationParams } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { hubUseCases } from '@/server/modules/hubs/hub.use-cases';

const deleteHubSchema = z.object({ id: z.string().min(1, 'Hub ID is required') });

// GET /api/admin/hubs — list all hubs (paginated)
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'hubs_manage')) return adminForbidden();
  try {
    const { page, limit } = parsePaginationParams(req.nextUrl);
    const result = await hubUseCases.listAdminHubs(page, limit);
    return success(result.hubs, undefined, 200, result.pagination);
  } catch (error) {
    logger.error('GET /api/admin/hubs error:', error);
    return errors.internal('Failed to fetch hubs');
  }
}

// POST /api/admin/hubs — create hub
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'hubs_manage')) return adminForbidden();
  try {
    const body = await req.json();
    const validation = validateBody(createHubSchema, body);
    if (!validation.success) return errors.validation(validation.error!);
    const hub = await hubUseCases.createHub(validation.data, session.adminId || '');
    return success(hub, 'Hub created', 201);
  } catch (error) {
    logger.error('POST /api/admin/hubs error:', error);
    return errors.internal('Failed to create hub');
  }
}

// PUT /api/admin/hubs — update hub
export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'hubs_manage')) return adminForbidden();
  try {
    const body = await req.json();
    const validation = validateBody(createHubSchema.partial().extend({ id: z.string().min(1) }), body);
    if (!validation.success) return errors.validation(validation.error!);
    const { id, ...data } = validation.data;
    const hub = await hubUseCases.updateHub(id, data, session.adminId || '');
    return success(hub);
  } catch (error) {
    logger.error('PUT /api/admin/hubs error:', error);
    return errors.internal('Failed to update hub');
  }
}

// DELETE /api/admin/hubs — delete hub
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'hubs_manage')) return adminForbidden();
  try {
    const body = await req.json();
    const validation = validateBody(deleteHubSchema, body);
    if (!validation.success) return errors.validation(validation.error!);
    const { id } = validation.data;
    await hubUseCases.deleteHub(id, session.adminId || '');
    return success(null, 'Hub deleted');
  } catch (error: any) {
    if (error?.message?.includes?.(`Cannot delete hub`)) {
      return errors.conflict(error.message);
    }
    logger.error('DELETE /api/admin/hubs error:', error);
    return errors.internal('Failed to delete hub');
  }
}
