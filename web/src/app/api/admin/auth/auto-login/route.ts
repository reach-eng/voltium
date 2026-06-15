import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { createSessionToken, ADMIN_SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_DEV_ADMIN_LOGIN !== 'true') {
    return errors.notFound('Not found');
  }

  try {
    const email = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      return errors.badRequest('Auto-login credentials not configured');
    }

    const admin = await adminUseCases.autoLogin(email, password);

    const sessionToken = createSessionToken({
      riderId: admin.id,
      riderDbId: admin.id,
      phone: admin.email,
      role: 'admin',
      adminRole: admin.role,
      adminId: admin.id,
    });

    logger.info('[Admin Auto-Login]', { adminId: admin.id, role: admin.role });

    const response = success(
      { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      'Auto-login successful'
    );

    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);

    return response;
  } catch (err: any) {
    if (err.message === 'Invalid credentials') {
      return errors.unauthorized('Invalid credentials');
    }
    logger.error('[POST /api/admin/auth/auto-login]', err);
    return errors.internal('Auto-login failed');
  }
}
