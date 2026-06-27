import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  /** When true, fail closed (deny) on DB outage. For auth endpoints, set to true. */
  failClosed?: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

function shouldUseDatabaseLimiter(): boolean {
  return (
    process.env.NODE_ENV === 'production' || process.env.RATE_LIMIT_STORE_PROVIDER === 'postgres'
  );
}

if (typeof globalThis !== 'undefined' && !('$_rateLimitCleanup' in globalThis)) {
  (globalThis as any).$_rateLimitCleanup = true;
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of memoryStore) {
        if (entry.resetAt <= now) memoryStore.delete(key);
      }
    },
    5 * 60 * 1000
  );
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = API_RATE_LIMIT
): Promise<RateLimitResult> {
  if (process.env.NODE_ENV !== 'production') {
    return { allowed: true, remaining: 1000, resetAt: Date.now() + 1000 };
  }

  const key = `ratelimit:${identifier}`;
  const now = Date.now();    if (shouldUseDatabaseLimiter()) {
    const resetAt = new Date(now + config.windowMs);
    await db.rateLimitBucket
      .deleteMany({ where: { resetAt: { lte: new Date(now - config.windowMs) } } })
      .catch(() => {});

    try {
      // Atomic conditional upsert: create or increment only if under limit
      // Note: Prisma maps camelCase model fields to camelCase PostgreSQL columns by default
      const result = (await db.$queryRawUnsafe(
        `INSERT INTO "RateLimitBucket" (id, key, points, "resetAt", "createdAt", "updatedAt")
         VALUES ($1, $2, 1, $3, NOW(), NOW())
         ON CONFLICT (key) DO UPDATE SET
           points = CASE
             WHEN "RateLimitBucket".points < $4 THEN "RateLimitBucket".points + 1
             ELSE "RateLimitBucket".points
           END,
           "resetAt" = CASE
             WHEN "RateLimitBucket"."resetAt" <= NOW() THEN $3
             ELSE "RateLimitBucket"."resetAt"
           END,
           "updatedAt" = NOW()
         RETURNING points, "resetAt"`,
        key,
        key,
        resetAt,
        config.maxRequests
      )) as Array<{ points: number; resetAt: Date }>;

      if (result.length > 0 && result[0].points <= config.maxRequests) {
        const rlResetAt = result[0].resetAt.getTime();
        return {
          allowed: true,
          remaining: Math.max(0, config.maxRequests - result[0].points),
          resetAt: rlResetAt,
        };
      }

      // Blocked
      const blockedResetAt = result.length > 0
        ? result[0].resetAt.getTime()
        : now + config.windowMs;
      return { allowed: false, remaining: 0, resetAt: blockedResetAt };
    } catch (dbErr: any) {
      // Fail closed for auth endpoints; fail open for non-auth
      if (config.failClosed) {
        // Auth endpoints: deny on DB outage
        logger.error('[RateLimit] DB outage on auth endpoint, denying:', dbErr.message);
        return { allowed: false, remaining: 0, resetAt: now + config.windowMs };
      }
      // Non-auth endpoints: allow on DB outage
      logger.warn('[RateLimit] DB outage, failing open:', dbErr.message);
      return { allowed: true, remaining: 1, resetAt: now + config.windowMs };
    }
  }

  const existing = memoryStore.get(key);
  if (existing && existing.resetAt <= now) memoryStore.delete(key);
  const entry = memoryStore.get(key);
  if (!entry) {
    const resetAt = now + config.windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }
  if (entry.count >= config.maxRequests)
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  entry.count += 1;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

export async function clearRateLimitStore(): Promise<void> {
  memoryStore.clear();
  if (shouldUseDatabaseLimiter()) await db.rateLimitBucket.deleteMany({}).catch(() => {});
}

export const AUTH_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxRequests: process.env.NODE_ENV === 'development' ? 1000 : 5,
  failClosed: true,
};

export const API_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 60,
};

export const UPLOAD_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 10,
};
