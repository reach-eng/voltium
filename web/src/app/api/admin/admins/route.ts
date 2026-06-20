import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { hashPassword } from '@/lib/password';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'admins_manage')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const search = url.searchParams.get('search') || '';
    const role = url.searchParams.get('role') || '';
    const isActive = url.searchParams.get('isActive');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20')), 100);

    const result = await adminUseCases.listAdmins({
      role,
      isActive: isActive !== null && isActive !== '' ? isActive === 'true' : undefined,
      search,
      page,
      limit,
    });
    return success(result.admins, undefined, 200, result.pagination);
  } catch (error) {
    logger.error('GET /api/admin/admins error:', error);
    return errors.internal('Failed to fetch admins');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'admins_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password)
      return errors.badRequest('name, email, password are required');
    if (password.length < 8) return errors.badRequest('Password must be at least 8 characters');

    const result = await adminUseCases.createAdmin(
      { name, email, password, role: role || 'SUPER_ADMIN', permissions: body.permissions },
      req.headers.get('x-admin-id') || 'system'
    );

    return success(result, 'Admin created', 201);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('POST /api/admin/admins error:', error);
    if (err.message.includes('already exists')) return errors.conflict(err.message);
    return errors.internal('Failed to create admin');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'admins_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const { id, password, ...data } = body;

    if (!id) return errors.badRequest('id is required');

    const updateData: any = { ...data };
    if (password) {
      if (password.length < 8) return errors.badRequest('Password must be at least 8 characters');
      updateData.password = await hashPassword(password);
    }

    const admin = await adminUseCases.updateAdmin(
      id,
      updateData,
      req.headers.get('x-admin-id') || 'system'
    );
    return success(admin);
  } catch (error) {
    logger.error('PUT /api/admin/admins error:', error);
    return errors.internal('Failed to update admin');
  }
}
