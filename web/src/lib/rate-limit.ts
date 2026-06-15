import { logger } from '@/lib/logger';

/**
 * In-Memory Rate Limiter
 *
 * Single-instance rate limiting using an in-memory map.
 * No Redis dependency — suitable for laptop-local deployment.
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

  // In-Memory rate limiting
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
