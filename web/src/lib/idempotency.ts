import { logger } from '@/lib/logger';

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
  memoryStore.set(key, {
    response,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}
