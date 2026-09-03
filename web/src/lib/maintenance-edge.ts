/**
 * Edge-safe maintenance-state reader for `middleware.ts`.
 *
 * P0 fix: `middleware.ts` previously imported `./lib/maintenance-cache`,
 * which imports `./lib/db` (PrismaClient + pino). Middleware runs on the
 * Edge runtime by default — Prisma/pino are Node-only and crash or bloat
 * the Edge bundle. Same for `./lib/auth` (cookie constant) and
 * `./lib/validators` (pulls `./lib/logger` → pino).
 *
 * This module has ZERO Node-only imports (no db, no logger, no jose).
 * It reads maintenance state via an internal HTTP fetch to
 * `/api/rider/maintenance-status` (Node runtime, Prisma-backed), with a
 * 5s in-memory TTL and fail-open semantics: any fetch/parse error returns
 * `{ enabled: false }` so a DB blip never walls off rider traffic.
 *
 * The maintenance-status route itself is excluded from the maintenance
 * gate in middleware, so there is no infinite loop.
 */

export interface EdgeMaintenanceState {
  enabled: boolean;
  message: string;
  timestamp: number;
}

export const DEFAULT_MAINTENANCE_MESSAGE =
  'System is currently under maintenance. Please check back later.';

let cached: EdgeMaintenanceState | null = null;
const TTL_MS = 5000;

export async function getEdgeMaintenanceState(
  requestUrl: string,
): Promise<EdgeMaintenanceState> {
  const now = Date.now();
  if (cached && now - cached.timestamp < TTL_MS) return cached;
  try {
    const url = new URL('/api/rider/maintenance-status', requestUrl);
    const res = await fetch(url.toString(), {
      headers: { 'x-internal-maintenance-check': '1' },
      // Never cache at the fetch layer; TTL is managed here.
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = (await res.json()) as {
      success?: boolean;
      data?: { enabled?: boolean; message?: string };
    };
    cached = {
      enabled: json?.data?.enabled === true,
      message:
        typeof json?.data?.message === 'string' && json.data.message.length > 0
          ? json.data.message
          : DEFAULT_MAINTENANCE_MESSAGE,
      timestamp: now,
    };
  } catch {
    // Fail-open: a DB blip must never block rider traffic behind a
    // phantom maintenance wall.
    cached = {
      enabled: false,
      message: DEFAULT_MAINTENANCE_MESSAGE,
      timestamp: now,
    };
  }
  return cached;
}

/** Test helper: drop the Edge maintenance cache. */
export function invalidateEdgeMaintenanceCache(): void {
  cached = null;
}
