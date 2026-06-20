import { NextRequest } from 'next/server';
import { success } from '@/lib/api-response';
import { SESSION_COOKIE_NAME } from '@/lib/auth';
import { getSession } from '@/lib/get-session';
import { createAuditLog } from '@/lib/audit-log';
import { authUseCases } from '@/server/modules/auth/auth.use-cases';
import { withApiHandler } from '@/lib/api-handler';

export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await getSession(request);
  if (session) {
    await authUseCases.logout(session.riderDbId).catch(() => {});
    await createAuditLog({
      actorId: session.riderDbId,
      actorType: 'RIDER',
      action: 'rider.logout',
      entity: 'rider',
      entityId: session.riderDbId,
    }).catch(() => {});
  }

  const response = success(null, 'Logged out successfully');

  // Clear the session cookie
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 0, // Expire immediately
  });

  return response;
});
