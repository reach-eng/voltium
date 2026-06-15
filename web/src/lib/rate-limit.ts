import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

/**
 * Ryd Production Rate Limiter
 *
 * Supports:
 * 1. In-Memory (for dev/single-instance)
 * 2. Upstash Redis (for multi-instance/serverless production)
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ─── Environment Configuration ─────────────────────────────────────────────
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Initialize Redis if credentials exist
const redis =
  UPSTASH_REDIS_URL && UPSTASH_REDIS_TOKEN
    ? new Redis({ url: UPSTASH_REDIS_URL, token: UPSTASH_REDIS_TOKEN })
    : null;

// ─── In-Memory Store Cleanup ───────────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const memoryStore = new Map<string, RateLimitEntry>();

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

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Check rate limit for a given identifier (IP, phone, etc.).
 * Returns boolean 'allowed' and metadata.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = API_RATE_LIMIT
): Promise<RateLimitResult> {
  // ── Bypass rate limiting for local dev or E2E if enabled ───────
  if (
    process.env.VOLTIUM_DEV_BYPASS_RATELIMIT === 'true' &&
    process.env.NODE_ENV === 'development'
  ) {
    return { allowed: true, remaining: 100, resetAt: Date.now() + 1000 };
  }

  const key = `ratelimit:${identifier}`;
  const now = Date.now();

  // Mode 1: Upstash Redis (Production-ready)
  if (redis) {
    try {
      const windowInSeconds = Math.floor(config.windowMs / 1000);

      // Increment and set expiry in one go
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowInSeconds);
      }

      const ttl = await redis.ttl(key);
      const resetAt = now + (ttl > 0 ? ttl * 1000 : config.windowMs);

      return {
        allowed: count <= config.maxRequests,
        remaining: Math.max(0, config.maxRequests - count),
        resetAt,
      };
    } catch (err) {
      logger.error('[RateLimit] Redis error, falling back to memory:', err);
    }
  }

  // Mode 2: In-Memory (Dev/Fallback)
  const existing = memoryStore.get(identifier);
  if (existing && existing.resetAt <= now) {
    memoryStore.delete(identifier);
  }

  const entry = memoryStore.get(identifier);

  if (!entry) {
    const resetAt = now + config.windowMs;
    memoryStore.set(identifier, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function clearRateLimitStore(): void {
  memoryStore.clear();
}

// ─── Preset Configurations ──────────────────────────────────────────────────

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
