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

// R10 polish #14 (Security 6.7) — cap the in-memory rate-limit store so a
// flood of unique identifiers can't grow it without bound. When we exceed the
// cap we evict the oldest entry (Map preserves insertion order). The DB
// limiter is unaffected — it has its own row-level lifecycle.
const MAX_MEMORY_STORE_SIZE = 50_000;

function evictIfFull(): void {
  while (memoryStore.size > MAX_MEMORY_STORE_SIZE) {
    const oldestKey = memoryStore.keys().next().value;
    if (oldestKey === undefined) break;
    memoryStore.delete(oldestKey);
  }
}

function shouldUseDatabaseLimiter(): boolean {
  return (
    process.env.APP_ENV === 'production' ||
    process.env.APP_ENV === 'staging' ||
    process.env.RATE_LIMIT_STORE_PROVIDER === 'postgres' ||
    process.env.RATE_LIMIT_STORE_PROVIDER === 'db'
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
             WHEN "RateLimitBucket".points < $4 + 1 THEN "RateLimitBucket".points + 1
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
    evictIfFull();
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
  maxRequests: process.env.APP_ENV === 'development' ? 1000 : 5,
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
