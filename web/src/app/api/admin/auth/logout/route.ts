import { NextRequest } from 'next/server';
import { success } from '@/lib/api-response';
import { ADMIN_SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { requireAdmin } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit-log';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';

// POST /api/admin/auth/logout — Clear admin session cookie
export async function POST(request: NextRequest) {
  const session = await requireAdmin();

  // P1-16: capture the source IP up front so logout events are attributable.
  // A logout with NO valid session writes no audit row — a cookie-clearing
  // no-op doesn't deserve an un-attributable 'system' entry; when a session
  // does exist the IP is attached for attribution.
  const clientIp = rateLimitIdentifierFromRequest(request).replace(/^ip:/, '');

  if (session) {
    if (session.adminId) {
      await adminUseCases.logout(session.adminId).catch(() => {});
    }
    await createAuditLog({
      actorId: session.adminId || session.riderDbId || 'system',
      action: 'admin.logout',
      entity: 'admin',
      entityId: session.adminId || session.riderDbId,
      details: { ip: clientIp },
    }).catch(() => {});
  }

  const response = success(null, 'Logged out successfully');

  // P1-17: reuse the shared cookie options (httpOnly, sameSite strict, the
  // APP_ENV-aware secure flag) instead of a hand-rolled near-copy that
  // dropped sameSite: 'strict' and keyed `secure` off NODE_ENV alone.
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0, // Expire immediately
  });

  return response;
}
