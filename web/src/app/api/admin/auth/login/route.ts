import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { createSessionToken, ADMIN_SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { checkRateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

export async function POST(request: NextRequest) {
  try {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rl = await checkRateLimit(`admin-login:${clientIp}`, AUTH_RATE_LIMIT);
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many login attempts. Try again later.');
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid request body');
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return errors.validation(parsed.error.issues[0]?.message || 'Validation failed');
    }

    const { email, password } = parsed.data;

    const admin = await adminUseCases.login(email, password, clientIp);

    let permissions: string[] = [];
    try {
      if (admin.permissions) {
        permissions = JSON.parse(admin.permissions);
      }
    } catch (e) {
      logger.error('Failed to parse admin permissions', { adminId: admin.id, error: e });
    }

    const sessionToken = createSessionToken({
      riderId: admin.id,
      riderDbId: admin.id,
      phone: admin.email,
      role: 'admin',
      adminRole: admin.role,
      adminId: admin.id,
      adminPermissions: permissions,
    });

    logger.info('[Admin Login]', { adminId: admin.id, role: admin.role });

    const response = success(
      { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      'Login successful'
    );

    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);

    return response;
  } catch (err: any) {
    if (err.message === 'Too many login attempts. Try again later.') {
      return errors.tooManyRequests(err.message);
    }
    if (err.message === 'Invalid credentials') {
      return errors.unauthorized('Invalid email or password');
    }
    logger.error('[POST /api/admin/auth/login]', err);
    return errors.internal('Login failed');
  }
}
