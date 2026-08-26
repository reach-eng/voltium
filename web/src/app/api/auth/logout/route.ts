import { NextRequest } from 'next/server';
import { success } from '@/lib/api-response';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { getSession } from '@/lib/get-session';
import { createAuditLog } from '@/lib/audit-log';
import { authUseCases } from '@/server/modules/auth/auth.use-cases';
import { withApiHandler } from '@/lib/api-middleware';

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
  // AUDIT FIX (N-14): the clear used hand-rolled options that had drifted
  // from SESSION_COOKIE_OPTIONS (same regression class P1-17 fixed on the
  // admin side) — a drift in path/domain here would leave the real session
  // cookie alive while the client believes it logged out. Derive from the
  // canonical options and only override maxAge to expire now.
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0, // Expire immediately
  });

  return response;
});
