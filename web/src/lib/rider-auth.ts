import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAdminSession } from '@/lib/get-session';
import { errors } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit-log';
import { hasPermission } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function requireRiderSession(
  request: NextRequest
): Promise<{ riderDbId: string; phone: string } | NextResponse> {
  const session = await getSession(request);
  if (session) {
    return { riderDbId: session.riderDbId, phone: session.phone };
  }

  // Allow admin to bypass auth if viewing a specific rider (deep-linking/dev-mode support)
  const adminSession = await getAdminSession(request);
  if (adminSession) {
    const riderId =
      request.nextUrl.searchParams.get('riderId') || request.headers.get('x-rider-id');
    if (riderId) {
      if (request.method !== 'GET') {
        return errors.forbidden('Impersonation is restricted to GET operations only');
      }

      if (!hasPermission(adminSession, 'impersonate_riders')) {
        return errors.forbidden('Impersonation requires impersonate_riders permission');
      }

      const adminId = adminSession.adminId || adminSession.riderDbId;
      const rateLimitResult = await checkRateLimit(`impersonation:${adminId}`, {
        windowMs: 60 * 1000,
        maxRequests: 10,
      });

      if (!rateLimitResult.allowed) {
        return errors.tooManyRequests('Too many impersonation requests');
      }

      await createAuditLog({
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'IMPERSONATE_RIDER',
        entity: 'rider',
        entityId: riderId,
        details: JSON.stringify({ adminRole: adminSession.adminRole }),
      });
      return { riderDbId: riderId, phone: '0000000000' };
    }
  }

  return errors.unauthorized('Authentication required');
}
