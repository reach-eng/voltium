import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAdminSession } from '@/lib/get-session';
import { errors } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit-log';

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
      createAuditLog({
        actorId: adminSession.adminId || adminSession.riderDbId,
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
