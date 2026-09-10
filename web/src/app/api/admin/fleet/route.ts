import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // P1-6 (device-tracking audit, 2026-09-08): align the route's
  // permission check with the nav entry. The previous OR check
  // (riders_view OR vehicles_view) made the route accessible
  // to roles that couldn't see the nav — a latent bug that
  // would surface if a future role reshuffled the two
  // permissions. The fleet map is rider-centric; `riders_view`
  // is the right key. Today every `vehicles_view` holder also
  // holds `riders_view`, so this is invisible.
  if (!hasPermission(session.adminRole || '', 'riders_view')) {
    return adminForbidden();
  }

  try {
    const url = req.nextUrl;
    const hubId = url.searchParams.get('hubId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const lowBattery = url.searchParams.get('lowBattery') === 'true';
    // 2026-09-09: the stale-device queue — riders who have never reported
    // telemetry. Also accepted as `neverReported=true` (ops deep links).
    const neverReported = url.searchParams.get('neverReported') === 'true';
    // P0: bound the fleet export (use-case caps at 200/page).
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 200);

    const result = await adminRiderUseCases.listFleet({
      hubId,
      status,
      search,
      lowBattery,
      neverReported,
      page,
      limit,
    });

    const response = withCacheHeaders(success(result), 5);
    // 2026-09-08 fleet-map audit (P1-3): `no-store` lets the client's
    // staleness banner trust response freshness; the 5s server cache
    // (withCacheHeaders) still dedupes the 30s polls server-side.
    response.headers.set('Cache-Control', 'private, max-age=0, must-revalidate, no-store');
    return response;
  } catch (error) {
    logger.error('GET /api/admin/fleet error:', error);
    return errors.internal('Failed to fetch fleet data');
  }
}
