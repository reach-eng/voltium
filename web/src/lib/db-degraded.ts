/**
 * Graceful Degradation for PostgreSQL outages.
 *
 * When the database is unavailable:
 *   - The admin UI gets a degraded-mode banner
 *   - Read-only operations are served from cache where possible
 *   - Write operations return a clear "service unavailable" message
 *   - Health checks are cached to avoid cascading failures
 */

import { logger } from './logger';

let isDegradedMode = false;
let degradedSince: number | null = null;
let healthCache: { status: string; cachedAt: number } | null = null;
const HEALTH_CACHE_TTL_MS = 60_000; // 1 minute

export const dbDegraded = {
  /** Enter degraded mode (called when DB connection fails) */
  enterDegradedMode(reason: string): void {
    if (!isDegradedMode) {
      isDegradedMode = true;
      degradedSince = Date.now();
      logger.warn('[DegradedMode] Entered degraded mode', { reason });
    }
  },

  /** Exit degraded mode (called when DB connection is restored) */
  exitDegradedMode(): void {
    if (isDegradedMode) {
      isDegradedMode = false;
      degradedSince = null;
      logger.info('[DegradedMode] Exited degraded mode —恢复正常');
    }
  },

  /** Check if we're in degraded mode */
  isDegraded(): boolean {
    return isDegradedMode;
  },

  /** Get degraded mode info for health endpoints */
  getStatus(): { degraded: boolean; since: number | null; durationSeconds: number | null } {
    return {
      degraded: isDegradedMode,
      since: degradedSince,
      durationSeconds: degradedSince ? Math.floor((Date.now() - degradedSince) / 1000) : null,
    };
  },

  /** Cache-aware health check: returns cached result if DB is down */
  async getCachedHealth(checkFn: () => Promise<any>): Promise<any> {
    // If cached and fresh, return cache
    if (healthCache && Date.now() - healthCache.cachedAt < HEALTH_CACHE_TTL_MS) {
      return healthCache;
    }

    try {
      const result = await checkFn();
      healthCache = { status: 'healthy', cachedAt: Date.now() };
      if (isDegradedMode) this.exitDegradedMode();
      return result;
    } catch (err) {
      this.enterDegradedMode(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : 'DB check failed');
      // Return cached result even if stale, rather than failing
      if (healthCache) return healthCache;
      throw err; // No cache at all — propagate
    }
  },
};
