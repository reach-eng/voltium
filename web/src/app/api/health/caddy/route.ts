import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin } from '@/lib/rbac';
import { requireCronAuth } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  // P0: consistent posture with the other health sub-routes (admin or cron).
  // Note: no Caddy exists in this topology — always Offline unless a tunnel
  // sidecar answers :2019. Kept for the server-health screen's probe matrix.
  const admin = await requireAdmin();
  if (!admin) {
    const cronRejection = requireCronAuth(request);
    if (cronRejection) return cronRejection;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    // Probe Caddy admin endpoint on port 2019
    const response = await fetch('http://localhost:2019/config/', {
      method: 'GET',
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    const isActive = response !== null && (response.ok || response.status === 200 || response.status === 401);
    const status = isActive ? 'Active' : 'Offline';

    return withCacheHeaders(
      success({
        status,
        checkedAt: new Date().toISOString(),
      }),
      0
    );
  } catch (err: unknown) {
    logger.error('[health/caddy] GET failed:', err);
    return withCacheHeaders(
      success({
        status: 'Offline',
        checkedAt: new Date().toISOString(),
      }),
      0
    );
  }
}
