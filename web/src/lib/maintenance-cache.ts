/**
 * PR-3 (2026-08-06 fix plan): shared maintenance-mode cache.
 *
 * The middleware previously kept a module-private `cachedMaintenanceState`
 * with a 5s TTL. The admin PUT /api/admin/maintenance-mode could NOT
 * invalidate it, so a rider toggling maintenance off via the admin panel
 * saw the rider API stay blocked for up to 5s.
 *
 * Extracted here so both the middleware (reader) and the admin route
 * (writer) share one cache with an explicit invalidation path.
 */

import { db } from './db';

export interface MaintenanceState {
  enabled: boolean;
  message: string;
  timestamp: number;
}

let cachedMaintenanceState: MaintenanceState | null = null;
const MAINTENANCE_CACHE_TTL = 5000; // 5s in-memory cache

export const DEFAULT_MAINTENANCE_MESSAGE =
  'System is currently under maintenance. Please check back later.';

/** Read the current maintenance state, using the 5s cache. */
export async function getMaintenanceState(): Promise<MaintenanceState> {
  const now = Date.now();
  if (
    cachedMaintenanceState &&
    now - cachedMaintenanceState.timestamp < MAINTENANCE_CACHE_TTL
  ) {
    return cachedMaintenanceState;
  }
  try {
    const [modeSetting, messageSetting] = await Promise.all([
      db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } }),
      db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MESSAGE' } }),
    ]);
    cachedMaintenanceState = {
      enabled: modeSetting?.value === 'true',
      message:
        messageSetting?.value ||
        'System is currently under maintenance. Please check back later.',
      timestamp: now,
    };
  } catch {
    // Fail-open on read errors: a DB blip must never block rider traffic
    // behind a phantom maintenance wall.
    cachedMaintenanceState = {
      enabled: false,
      message: 'System is currently under maintenance. Please check back later.',
      timestamp: now,
    };
  }
  return cachedMaintenanceState;
}

/** Drop the cache so the next read re-queries the DB (PR-3). */
export function invalidateMaintenanceCache(): void {
  cachedMaintenanceState = null;
}
