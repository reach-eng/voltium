import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

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
const EVICTION_BATCH_SIZE = 500;

function evictIfFull(): void {
  if (memoryStore.size >= MAX_MEMORY_STORE_SIZE) {
    const now = Date.now();
    let evicted = 0;
    // First pass: purge expired entries
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt <= now) {
        memoryStore.delete(key);
        evicted++;
        if (evicted >= EVICTION_BATCH_SIZE) return;
      }
    }
    // Second pass: evict oldest entries if still over 90% capacity
    if (memoryStore.size >= MAX_MEMORY_STORE_SIZE * 0.9) {
      for (const [key] of memoryStore) {
        memoryStore.delete(key);
        evicted++;
        if (evicted >= EVICTION_BATCH_SIZE) break;
      }
    }
  }
}

function shouldUseDatabaseLimiter(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.USE_DB_RATE_LIMITER === 'true';
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
  const now = Date.now();
  if (shouldUseDatabaseLimiter()) {
    const resetAt = new Date(now + config.windowMs);
    await db.rateLimitBucket
      .deleteMany({ where: { resetAt: { lte: new Date(now - config.windowMs) } } })
      .catch(() => {});

    try {
      const queryMethod = (db as any).$queryRaw || (db as any).$queryRawUnsafe;
      const result = (await queryMethod.call(
        db,
        Prisma.sql`INSERT INTO "rate_limit_buckets" (id, key, points, "resetAt", "createdAt", "updatedAt")
         VALUES (${key}, ${key}, 1, ${resetAt}, NOW(), NOW())
         ON CONFLICT (key) DO UPDATE SET
           points = CASE
             WHEN "rate_limit_buckets".points < ${config.maxRequests} + 1 THEN "rate_limit_buckets".points + 1
             ELSE "rate_limit_buckets".points
           END,
           "resetAt" = CASE
             WHEN "rate_limit_buckets"."resetAt" <= NOW() THEN ${resetAt}
             ELSE "rate_limit_buckets"."resetAt"
           END,
           "updatedAt" = NOW()
         RETURNING points, "resetAt"`
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
