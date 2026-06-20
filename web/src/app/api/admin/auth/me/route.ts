import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';
import { logger } from '@/lib/logger';

export async function GET(_request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return errors.unauthorized('Not authenticated');
  }

  const adminId = session.adminId || session.riderDbId;

  try {
    const admin = await adminUseCases.getMe(adminId);
    if (!admin.isActive) {
      return errors.forbidden('Account not found or deactivated');
    }
    return success(admin);
  } catch (err: any) {
    if (adminId === 'admin-dev-id' || process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_ADMIN_LOGIN === 'true') {
      logger.warn('[Admin Me] Database check failed, falling back to mock admin info:', err.message);
      const mockAdmin = {
        id: adminId || 'admin-dev-id',
        email: session.phone || 'admin@voltium.io',
        name: 'Dev Admin',
        role: session.adminRole || 'SUPER_ADMIN',
        isActive: true,
        permissions: [],
        adminPermissions: [],
      };
      return success(mockAdmin);
    }
    logger.error('[GET /api/admin/auth/me]', err);
    return errors.forbidden('Account validation failed');
  }
}
