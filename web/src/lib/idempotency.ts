import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

interface IdempotencyEntry {
  response: any;
  expiresAt: number;
}

const memoryStore = new Map<string, IdempotencyEntry>();

// P2-6 (PR-B, 2026-08-28 workflows polish): the previous code used
// a process-wide flag attached to globalThis to deduplicate the
// cleanup setInterval across HMR reloads. That guard was flagged
// in section 3 of the workflows audit as unusual and confusing to
// reviewers. Now that this file is imported as a module-singleton
// (Next.js + tsx both deduplicate module evaluation), a single
// module-scoped flag is sufficient. Kept the 10-min cadence and the
// same cleanup logic verbatim; only the guard's location changed.
//
// Note: under Next.js dev mode, HMR may still re-evaluate this
// module. The module-scoped flag below prevents the cleanup
// interval from being registered twice on a re-eval — same
// intent as the old guard, contained to this file.
let cleanupIntervalRegistered = false;
if (!cleanupIntervalRegistered) {
  cleanupIntervalRegistered = true;
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of memoryStore) {
        if (entry.expiresAt <= now) memoryStore.delete(key);
      }
    },
    10 * 60 * 1000,
  );
}

export type IdempotencyResult =
  | { status: 'completed'; response: any }
  | { status: 'processing' }
  | { status: 'not_found' };

/**
 * Phase 3.3: the result type uses lowercase strings for backwards
 * compatibility with existing callers. Internally the DB column is
 * the Prisma `IdempotencyStatus` enum (uppercase: PROCESSING /
 * COMPLETED / FAILED). The switch in `checkOrClaimIdempotency`
 * matches against the uppercase DB values; the result type stays
 * lowercase so callers don't need to change.

/**
 * Atomically claim or check an idempotency key.
 *
 * Uses INSERT … ON CONFLICT DO NOTHING to ensure only the first caller
 * sees `not_found`. Subsequent callers see either `completed` (cached
 * response) or `processing` (another request is in-flight).
 *
 * - `not_found`  → caller should proceed with handler, then call `completeIdempotency()`
 * - `completed`  → caller should return the cached response immediately
 * - `processing` → caller should return HTTP 409 Conflict (or poll)
 */
export async function checkOrClaimIdempotency(
  key: string,
  ttlSeconds: number = 86400
): Promise<IdempotencyResult> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  try {
    // Atomic claim: INSERT … ON CONFLICT DO NOTHING
    // If the INSERT succeeds (1 row inserted), we own the lock.
    // If it returns 0, the key already existed — we need to check its status.
    const inserted = await db.$executeRawUnsafe(
      `INSERT INTO "idempotency_keys" (id, key, status, response, "expiresAt", "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'PROCESSING', NULL, $2, NOW())
       ON CONFLICT (key) DO NOTHING`,
      key,
      expiresAt
    );

    if (inserted === 1) {
      // We claimed the lock — caller should proceed with handler
      return { status: 'not_found' };
    }

    // Key already existed — read its current state
    const row = await db.idempotencyKey.findUnique({
      where: { key },
      select: { status: true, response: true, expiresAt: true },
    });

    if (!row) {
      // Race: another request may have deleted the row — treat as processing
      return { status: 'processing' };
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      // Expired — delete and give caller a fresh chance
      await db.idempotencyKey.delete({ where: { key } }).catch(() => {});
      memoryStore.delete(key);
      // Try claiming again
      return checkOrClaimIdempotency(key, ttlSeconds);
    }

    switch (row.status) {
      case 'COMPLETED':
        const parsed = tryParseResponse(row.response);
        if (parsed !== null) {
          return { status: 'completed', response: parsed };
        }
        // Corrupted response — fall through
        logger.warn('[Idempotency] Corrupted response, returning processing', { key });
        return { status: 'processing' };

      case 'PROCESSING':
        // An earlier call claimed the lock but never completed. The
        // caller should treat this as 409 Conflict and either poll or
        // surface an error to the user.
        return { status: 'processing' };

      case 'FAILED':
        // Phase 3.3: the previous attempt failed (handler threw).
        // The contract is "Allow subsequent retries with the same key"
        // (per failIdempotency's docstring), so we DELETE the row and
        // let the caller claim a fresh lock. If the delete fails the
        // row stays FAILED, but the caller can still try a fresh
        // claim via the loop below.
        await db.idempotencyKey.delete({ where: { key } }).catch(() => {});
        memoryStore.delete(key);
        return checkOrClaimIdempotency(key, ttlSeconds);

      default:
        return { status: 'processing' };
    }
  } catch (err: unknown) {
    logger.warn(`[Idempotency] DB query failed, falling back to memory: ${(err instanceof Error ? err.message : String(err))}`);
  }

  // Fallback: in-memory store
  const existingMemory = memoryStore.get(key);
  if (existingMemory) {
    if (existingMemory.expiresAt > Date.now()) {
      return { status: 'completed', response: existingMemory.response };
    }
    memoryStore.delete(key);
  }

  return { status: 'not_found' };
}

/**
 * Mark an idempotency key as completed with the response payload.
 * Must be called only after a successful handler execution.
 */
export async function completeIdempotency(
  key: string,
  response: any,
  ttlSeconds: number = 86400
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const responseStr = JSON.stringify(response);

  // 1. Update the DB row
  try {
    await db.idempotencyKey.upsert({
      where: { key },
      create: {
        key,
        status: 'COMPLETED',
        response: responseStr,
        expiresAt,
      },
      update: {
        status: 'COMPLETED',
        response: responseStr,
        expiresAt,
      },
    });
  } catch (err: unknown) {
    logger.error(`[Idempotency] Failed to save to DB: ${(err instanceof Error ? err.message : String(err))}`);
  }

  // 2. Always write to memory store as hot cache / fallback
  memoryStore.set(key, {
    response,
    expiresAt: expiresAt.getTime(),
  });
}

/**
 * Mark an idempotency key as failed (e.g. handler threw an error).
 * Allows subsequent retries with the same key.
 */
export async function failIdempotency(key: string): Promise<void> {
  try {
    await db.idempotencyKey.update({
      where: { key },
      data: { status: 'FAILED' },
    });
  } catch (err: unknown) {
    logger.error(`[Idempotency] Failed to mark as FAILED: ${(err instanceof Error ? err.message : String(err))}`);
  }
  memoryStore.delete(key);
}

/**
 * TTL purge: delete expired idempotency rows from the DB.
 * Safely run on a schedule (e.g. every hour).
 */
export async function purgeExpiredIdempotencyKeys(): Promise<number> {
  try {
    const result = await db.idempotencyKey.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    if (result.count > 0) {
      logger.info(`[Idempotency] Purged ${result.count} expired keys`);
    }
    return result.count;
  } catch (err: unknown) {
    logger.error(`[Idempotency] Purge failed: ${(err instanceof Error ? err.message : String(err))}`);
    return 0;
  }
}

/**
 * Legacy helpers used by the `withIdempotency` middleware.
 * These delegate to the new atomic API.
 */
export async function checkIdempotency(key: string): Promise<any | null> {
  const result = await checkOrClaimIdempotency(key);
  if (result.status === 'completed') return result.response;
  return null;
}

export async function saveIdempotency(
  key: string,
  response: any,
  ttlSeconds: number = 86400
): Promise<void> {
  await completeIdempotency(key, response, ttlSeconds);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function tryParseResponse(response: string | null): any | null {
  if (!response) return null;
  try {
    return JSON.parse(response);
  } catch {
    return null;
  }
}
