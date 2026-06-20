import { NextRequest } from 'next/server';
import { success } from '@/lib/api-response';
import { ADMIN_SESSION_COOKIE_NAME } from '@/lib/auth';
import { requireAdmin } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit-log';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';

// POST /api/admin/auth/logout — Clear admin session cookie
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (session) {
    if (session.adminId) {
      await adminUseCases.logout(session.adminId).catch(() => {});
    }
    await createAuditLog({
      actorId: session.adminId || session.riderDbId || 'system',
      action: 'admin.logout',
      entity: 'admin',
      entityId: session.adminId || session.riderDbId,
    }).catch(() => {});
  }

  const response = success(null, 'Logged out successfully');

  // Clear the admin session cookie
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0, // Expire immediately
  });

  return response;
}
