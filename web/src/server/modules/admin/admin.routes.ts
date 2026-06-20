/**
 * Thin admin route handlers using withPermission / withAdmin wrappers.
 * These are designed to be exported by Next.js route.ts files.
 */

import { NextRequest } from 'next/server';
import { withPermission, withAdmin } from './admin.policy';
import { adminUseCases } from './admin.use-cases';
import { CreateAdminSchema, UpdateAdminSchema, AuditLogQuerySchema } from './admin.schemas';
import { success, errors } from '@/lib/api-response';

export const adminRoutes = {
  // GET /api/admin/admins — List all admin users
  list: withPermission('admins_manage', async (req: NextRequest) => {
    const url = new URL(req.url);
    const role = url.searchParams.get('role') || undefined;
    const isActive = url.searchParams.get('isActive');
    const search = url.searchParams.get('search') || undefined;

    const admins = await adminUseCases.listAdmins({
      role,
      isActive: isActive !== null ? isActive === 'true' : undefined,
      search,
    });

    return success(admins, 'Admin users retrieved');
  }),

  // GET /api/admin/admins/[id] — Get single admin
  get: withPermission('admins_manage', async (req: NextRequest) => {
    // Extract ID from pathname: /api/admin/admins/<id>
    const pathParts = req.nextUrl.pathname.split('/').filter(Boolean);
    const id = pathParts[pathParts.length - 1] || '';

    if (!id || id === 'admins') {
      return errors.badRequest('Admin ID is required');
    }

    try {
      const admin = await adminUseCases.getAdmin(id);
      return success(admin);
    } catch (err: any) {
      return errors.notFound(err.message);
    }
  }),

  // POST /api/admin/admins — Create new admin
  create: withPermission('admins_manage', async (req: NextRequest, session: any) => {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return errors.badRequest('Invalid JSON body');
    }

    const parsed = CreateAdminSchema.safeParse(body);
    if (!parsed.success) {
      return errors.validation('Invalid input', {
        details: parsed.error.flatten(),
      });
    }

    try {
      const admin = await adminUseCases.createAdmin(
        parsed.data,
        session.adminId || session.riderDbId
      );
      return success(admin, 'Admin user created', 201);
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        return errors.conflict(err.message);
      }
      throw err;
    }
  }),

  // PUT /api/admin/admins/[id] — Update admin
  update: withPermission('admins_manage', async (req: NextRequest, session: any) => {
    const pathParts = req.nextUrl.pathname.split('/').filter(Boolean);
    const id = pathParts[pathParts.length - 1] || '';

    if (!id || id === 'admins') {
      return errors.badRequest('Admin ID is required');
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return errors.badRequest('Invalid JSON body');
    }

    const parsed = UpdateAdminSchema.safeParse(body);
    if (!parsed.success) {
      return errors.validation('Invalid input', {
        details: parsed.error.flatten(),
      });
    }

    try {
      const admin = await adminUseCases.updateAdmin(
        id,
        parsed.data,
        session.adminId || session.riderDbId
      );
      return success(admin, 'Admin user updated');
    } catch (err: any) {
      return errors.notFound(err.message);
    }
  }),

  // DELETE /api/admin/admins/[id] — Delete admin
  delete: withPermission('admins_manage', async (req: NextRequest, session: any) => {
    const pathParts = req.nextUrl.pathname.split('/').filter(Boolean);
    const id = pathParts[pathParts.length - 1] || '';

    if (!id || id === 'admins') {
      return errors.badRequest('Admin ID is required');
    }

    try {
      await adminUseCases.deleteAdmin(id, session.adminId || session.riderDbId);
      return success(null, 'Admin user deleted');
    } catch (err: any) {
      return errors.notFound(err.message);
    }
  }),

  // GET /api/admin/audit-logs — List audit logs
  auditLogs: withAdmin(async (req: NextRequest) => {
    const url = new URL(req.url);
    const params = AuditLogQuerySchema.parse(Object.fromEntries(url.searchParams));

    const result = await adminUseCases.getAuditLogs(params);

    return success(result.logs, 'Audit logs retrieved', 200, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  }),
};
