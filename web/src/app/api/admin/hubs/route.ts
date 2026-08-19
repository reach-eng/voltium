import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { validateBody, createHubSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { parsePositiveInt } from '@/lib/api-utils';
import { hasPermission } from '@/lib/auth';
import { getOrSetResponse, invalidateCache } from '@/lib/cache';
import { hubUseCases } from '@/server/modules/hubs/hub.use-cases';

const deleteHubSchema = z.object({ id: z.string().min(1, 'Hub ID is required') });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// GET /api/admin/hubs — list all hubs (paginated)
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'hubs_manage')) return adminForbidden();
  try {
    // DEEP-AUDIT D-P1-1: parsePositiveInt (NaN-safe) replaces the removed
    // parsePaginationParams helper.
    const page = parsePositiveInt(req.nextUrl.searchParams.get('page'), 1);
    const limit = parsePositiveInt(req.nextUrl.searchParams.get('limit'), 20, 100);
    const cacheKey = [
      'admin:hubs',
      session.adminId ?? session.riderDbId ?? 'anon',
      page,
      limit,
    ].join(':');
    const result = await getOrSetResponse(cacheKey, () => hubUseCases.listAdminHubs(page, limit), 30);
    if (!result) return errors.internal('Failed to fetch hubs');
    return withCacheHeaders(success(result.hubs, undefined, 200, result.pagination), 30);
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
    invalidateCache('admin:*');
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
    const validation = validateBody(
      createHubSchema.partial().extend({ id: z.string().min(1) }),
      body
    );
    if (!validation.success) return errors.validation(validation.error!);
    const { id, ...data } = validation.data;
    const hub = await hubUseCases.updateHub(id, data, session.adminId || '');
    invalidateCache('admin:*');
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
    invalidateCache('admin:*');
    return success(null, 'Hub deleted');
  } catch (error: unknown) {
    const message = errorMessage(error);
    if (message.includes('Cannot delete hub')) {
      return errors.conflict(message);
    }
    logger.error('DELETE /api/admin/hubs error:', error);
    return errors.internal('Failed to delete hub');
  }
}
