import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { hashPassword } from '@/lib/password';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';
import type { AdminRole } from '@/server/modules/admin/admin.types';
import type { UpdateAdminParams } from '@/server/modules/admin/admin.repository';

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

    // Validate role is a known admin role — never default to SUPER_ADMIN
    const allowedRoles = ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER', 'FINANCE_ADMIN', 'SUPPORT_AGENT', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER', 'READ_ONLY'];
    const validatedRole = role && allowedRoles.includes(role) ? role : 'READ_ONLY';

    // Validate permissions against known keys
    const { PERMISSION_DESCRIPTORS } = await import('@/lib/permissions');
    const validPermissionKeys = PERMISSION_DESCRIPTORS.map(p => p.key) as string[];
    const permissions = Array.isArray(body.permissions)
      ? body.permissions.filter((p: unknown) => typeof p === 'string' && validPermissionKeys.includes(p))
      : [];

    const result = await adminUseCases.createAdmin(
      { name, email, password, role: validatedRole, permissions },
      session.adminId || session.riderDbId || 'system'
    );

    return success(result, 'Admin created', 201);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('POST /api/admin/admins error:', error);
    if ((err instanceof Error ? err.message : String(err)).includes('already exists')) return errors.conflict((err instanceof Error ? err.message : String(err)));
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

    const updateData: UpdateAdminParams = {
      email: typeof data.email === 'string' ? data.email : undefined,
      name: typeof data.name === 'string' ? data.name : undefined,
      role: typeof data.role === 'string' ? (data.role as AdminRole) : undefined,
      permissions: Array.isArray(data.permissions) ? data.permissions : undefined,
      isActive: typeof data.isActive === 'boolean' ? data.isActive : undefined,
    };
    if (password) {
      if (password.length < 8) return errors.badRequest('Password must be at least 8 characters');
      updateData.password = await hashPassword(password);
    }

    const admin = await adminUseCases.updateAdmin(
      id,
      updateData,
      session.adminId || session.riderDbId || 'system'
    );
    return success(admin);
  } catch (error) {
    logger.error('PUT /api/admin/admins error:', error);
    return errors.internal('Failed to update admin');
  }
}
