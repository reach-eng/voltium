import { db } from '@/lib/db';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
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
  const now = Date.now();

  if (shouldUseDatabaseLimiter()) {
    const resetAt = new Date(now + config.windowMs);
    await db.rateLimitBucket
      .deleteMany({ where: { resetAt: { lte: new Date(now - config.windowMs) } } })
      .catch(() => {});

    const existing = await db.rateLimitBucket.findUnique({ where: { key } }).catch(() => null);
    if (!existing || existing.resetAt.getTime() <= now) {
      await db.rateLimitBucket.upsert({
        where: { key },
        create: { key, points: 1, resetAt },
        update: { points: 1, resetAt },
      });
      return { allowed: true, remaining: config.maxRequests - 1, resetAt: resetAt.getTime() };
    }

    if (existing.points >= config.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt.getTime() };
    }

    const updated = await db.rateLimitBucket.update({
      where: { key },
      data: { points: { increment: 1 } },
    });
    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - updated.points),
      resetAt: existing.resetAt.getTime(),
    };
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
};

export const API_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 60,
};

export const UPLOAD_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 10,
};
