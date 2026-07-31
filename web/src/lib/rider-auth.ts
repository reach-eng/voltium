import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAdminSession } from '@/lib/get-session';
import { errors } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit-log';
import { hasPermission } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';

export async function requireRiderSession(
  request: NextRequest
): Promise<{ riderDbId: string; phone: string } | NextResponse> {
  const session = await getSession(request);
  if (session) {
    if (session.role !== 'rider') {
      // Admin tokens must not be accepted as rider session tokens.
      // Only the explicit impersonation path below (with x-rider-id header) may use admin tokens.
      return errors.forbidden('Admin tokens cannot access rider endpoints');
    }
    return { riderDbId: session.riderDbId, phone: session.phone };
  }

  // Allow admin to bypass auth if viewing a specific rider (deep-linking/dev-mode support)
  // Gated behind ENABLE_RIDER_IMPERSONATION env flag. Must be explicitly set even in dev
  // to prevent accidental enablement in any shared environment.
  const adminSession = await getAdminSession(request);
  if (
    adminSession &&
    process.env.ENABLE_RIDER_IMPERSONATION === 'true' &&
    process.env.APP_ENV !== 'production'
  ) {
    const riderId = request.headers.get('x-rider-id');
    if (riderId) {
      if (request.method !== 'GET') {
        return errors.forbidden('Impersonation is restricted to GET operations only');
      }

      if (!hasPermission(adminSession, 'impersonate_riders')) {
        return errors.forbidden('Impersonation requires impersonate_riders permission');
      }

      // Validate rider exists in DB
      const targetRider = await db.rider.findFirst({
        where: {
          OR: [{ id: riderId }, { riderId: riderId }],
        },
        select: { id: true, phone: true },
      });

      if (!targetRider) {
        return errors.notFound('Impersonated rider not found');
      }

      const adminId = adminSession.adminId || adminSession.riderDbId;
      const rateLimitResult = await checkRateLimit(`impersonation:${adminId}`, {
        windowMs: 60 * 1000,
        maxRequests: 30,
      });

      if (!rateLimitResult.allowed) {
        return errors.tooManyRequests('Too many impersonation requests');
      }

      await createAuditLog({
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'IMPERSONATE_RIDER',
        entity: 'rider',
        entityId: targetRider.id,
        details: JSON.stringify({ adminRole: adminSession.adminRole }),
      });
      return { riderDbId: targetRider.id, phone: targetRider.phone };
    }
  }

  return errors.unauthorized('Authentication required');
}
