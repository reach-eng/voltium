import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

interface IdempotencyEntry {
  response: any;
  expiresAt: number;
}

const memoryStore = new Map<string, IdempotencyEntry>();

// Keep memory store cleanup interval as fallback
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
  // 1. Try DB-backed store
  try {
    const existing = await db.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing) {
      if (existing.expiresAt.getTime() > Date.now()) {
        return JSON.parse(existing.response);
      } else {
        await db.idempotencyKey.delete({ where: { key } }).catch(() => {});
      }
    }
  } catch (err: any) {
    logger.warn(`[Idempotency] DB query failed, falling back to memory: ${err.message}`);
  }

  // 2. Fall back to memory store
  const existingMemory = memoryStore.get(key);
  if (existingMemory) {
    if (existingMemory.expiresAt > Date.now()) {
      return existingMemory.response;
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
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const responseStr = JSON.stringify(response);

  // 1. Try DB-backed store
  try {
    await db.idempotencyKey.upsert({
      where: { key },
      create: {
        key,
        response: responseStr,
        expiresAt,
      },
      update: {
        response: responseStr,
        expiresAt,
      },
    });
  } catch (err: any) {
    logger.error(`[Idempotency] Failed to save to DB: ${err.message}`);
  }

  // 2. Always write to memory store as hot cache / fallback
  memoryStore.set(key, {
    response,
    expiresAt: expiresAt.getTime(),
  });
}
