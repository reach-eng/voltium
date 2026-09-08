import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { supportUseCases } from '@/server/modules/support/support.use-cases';
import { parsePositiveInt } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';

// GET /api/admin/sos/recent — recent SOS triggers for the safety banners.
//
// SOS alerts are NOT support tickets (Prisma TicketCategory has no SOS
// member) — they are `emergency.sos_triggered` audit-log events. The old
// banners queried `?category=SOS` (zero lifetime rows) and stayed silent
// forever. Triage audience: support + ops/finance readers.
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // Triage audience: support roles (tickets_view) + ops/finance readers
  // (audit_view). Session form honors explicit per-admin grants.
  if (!hasPermission(session, 'tickets_view') && !hasPermission(session, 'audit_view')) {
    return adminForbidden();
  }

  // P1: polled every 30s by up to two banners per admin — cap per admin.
  const SOS_LIMIT = { windowMs: 60_000, maxRequests: 60 };
  const rl = await checkRateLimit(`admin:sos:${session.adminId || 'unknown'}`, SOS_LIMIT);
  if (!rl.allowed) {
    return errors.tooManyRequests('Too many requests. Please try again later.', {
      rateLimit: { limit: SOS_LIMIT.maxRequests, remaining: rl.remaining, resetAt: rl.resetAt },
    });
  }

  try {
    const url = req.nextUrl;
    const hours = parsePositiveInt(url.searchParams.get('hours'), 24, 168);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 10, 50);

    const result = await supportUseCases.getRecentSosEvents({ hours, limit });
    return withCacheHeaders(success(result), 10);
  } catch (error) {
    logger.error('GET /api/admin/sos/recent error:', error);
    return errors.internal('Failed to fetch recent SOS events');
  }
}
