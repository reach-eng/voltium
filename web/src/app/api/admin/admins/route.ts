import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { hashPassword } from '@/lib/password';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';
import type { AdminRole } from '@/server/modules/admin/admin.types';
import type { UpdateAdminParams } from '@/server/modules/admin/admin.repository';
import { createAdminSchema, updateAdminSchema } from '@/lib/validators/admin';

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
    return withCacheHeaders(success(result.admins, undefined, 200, result.pagination), 10);
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
    const validation = createAdminSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);

    const { name, email, password, role, permissions: rawPermissions } = validation.data;

    // Validate permissions against known keys (server-side allowlist)
    const { PERMISSION_DESCRIPTORS } = await import('@/lib/permissions');
    const validPermissionKeys = PERMISSION_DESCRIPTORS.map(p => p.key) as string[];
    const permissions = (rawPermissions ?? []).filter(
      (p: unknown) => typeof p === 'string' && validPermissionKeys.includes(p)
    );

    const result = await adminUseCases.createAdmin(
      { name, email, password, role: (role as AdminRole) ?? 'READ_ONLY', permissions },
      session.adminId ?? session.riderDbId ?? 'system'
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
    const validation = updateAdminSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);

    const { id, password, email, name, role, permissions, isActive } = validation.data;

    const updateData: UpdateAdminParams = {
      email,
      name,
      role: role as AdminRole | undefined,
      permissions,
      isActive,
    };
    if (password) {
      updateData.password = await hashPassword(password);
    }

    const admin = await adminUseCases.updateAdmin(
      id,
      updateData,
      session.adminId ?? session.riderDbId ?? 'system'
    );
    return success(admin);
  } catch (error) {
    logger.error('PUT /api/admin/admins error:', error);
    return errors.internal('Failed to update admin');
  }
}
