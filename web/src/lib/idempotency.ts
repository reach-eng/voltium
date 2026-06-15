import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  UPSTASH_REDIS_URL && UPSTASH_REDIS_TOKEN
    ? new Redis({ url: UPSTASH_REDIS_URL, token: UPSTASH_REDIS_TOKEN })
    : null;

interface IdempotencyEntry {
  response: any;
  expiresAt: number;
}

const memoryStore = new Map<string, IdempotencyEntry>();

if (typeof globalThis !== 'undefined' && !('$_idempotencyCleanup' in globalThis)) {
  (globalThis as any).$_idempotencyCleanup = true;
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of memoryStore) {
        if (entry.expiresAt <= now) memoryStore.delete(key);
      }
    },
    10 * 60 * 1000
  );
}

export async function checkIdempotency(key: string): Promise<any | null> {
  const fullKey = `idempotency:${key}`;
  if (redis) {
    try {
      const cached = await redis.get(fullKey);
      if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }
    } catch (err) {
      logger.error('[Idempotency] Redis check error:', err);
    }
  }

  const existing = memoryStore.get(key);
  if (existing) {
    if (existing.expiresAt > Date.now()) {
      return existing.response;
    } else {
      memoryStore.delete(key);
    }
  }

  return null;
}

export async function saveIdempotency(
  key: string,
  response: any,
  ttlSeconds: number = 86400
): Promise<void> {
  const fullKey = `idempotency:${key}`;
  if (redis) {
    try {
      await redis.set(fullKey, JSON.stringify(response), { ex: ttlSeconds });
    } catch (err) {
      logger.error('[Idempotency] Redis save error:', err);
    }
  }

  memoryStore.set(key, {
    response,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}
