import { NextRequest } from 'next/server';
import { success, errors, error } from '@/lib/api-response';
import { createSessionToken, ADMIN_SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';

export async function POST(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_ADMIN_LOGIN === 'true';
  if (!isDev) {
    return errors.notFound('Not found');
  }

  try {
    const email = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@voltium.io';
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
      logger.error('[Admin Auto-Login] ADMIN_PASSWORD environment variable is not configured');
      return errors.internal('Auto-login is misconfigured: ADMIN_PASSWORD is required');
    }

    let admin;
    try {
      admin = await adminUseCases.autoLogin(email, password);
    } catch (err: any) {
      logger.error('[Admin Auto-Login] Database lookup or password verification failed:', err);
      // Return 503 Service Unavailable if database is down/issue, or 401 on invalid credentials
      if (err.message === 'Invalid credentials') {
        return errors.unauthorized('Invalid credentials');
      }
      return error('Database or authentication service unavailable', 'SERVICE_UNAVAILABLE', 503);
    }

    const sessionToken = createSessionToken({
      riderId: admin.id,
      riderDbId: admin.id,
      phone: admin.email,
      role: 'admin',
      adminRole: admin.role,
      adminId: admin.id,
      tokenVersion: admin.tokenVersion,
    });

    logger.info('[Admin Auto-Login]', { adminId: admin.id, role: admin.role });

    const response = success(
      { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      'Auto-login successful'
    );

    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);

    return response;
  } catch (err: any) {
    logger.error('[POST /api/admin/auth/auto-login]', err);
    return errors.internal('Auto-login failed');
  }
}
