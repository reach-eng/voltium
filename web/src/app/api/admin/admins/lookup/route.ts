import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // P0: previously any admin (incl. READ_ONLY) could enumerate admin
  // emails. Gate on audit_view (same audience as the dashboard activity
  // stream, the only caller) and return names only.
  if (!hasPermission(session, 'audit_view')) return adminForbidden();

  // Called on every audit-log poll — cap per admin.
  const LOOKUP_LIMIT = { windowMs: 60_000, maxRequests: 60 };
  const rl = await checkRateLimit(`admin:lookup:${session.adminId || 'unknown'}`, LOOKUP_LIMIT);
  if (!rl.allowed) {
    return errors.tooManyRequests('Too many requests. Please try again later.', {
      rateLimit: { limit: LOOKUP_LIMIT.maxRequests, remaining: rl.remaining, resetAt: rl.resetAt },
    });
  }

  try {
    const idsParam = req.nextUrl.searchParams.get('ids');
    if (!idsParam) {
      return success([]);
    }

    const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean).slice(0, 100);
    if (ids.length === 0) {
      return success([]);
    }

    const admins = await db.admin.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });

    return success(admins);
  } catch (error) {
    logger.error('GET /api/admin/admins/lookup error:', error);
    return errors.internal('Failed to lookup admin names');
  }
}
