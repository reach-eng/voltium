import { createHash } from 'node:crypto';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

interface IdempotencyEntry {
  response: any;
  expiresAt: number;
}

/**
 * 9.5+ Hardening §10 (T-9P0-7): compute a deterministic request-body
 * fingerprint. The same Idempotency-Key with a different request body
 * is a different operation; we surface that as 409 IDEMPOTENCY_CONFLICT
 * instead of silently replaying the cached response.
 *
 * JSON.stringify is not deterministic (key order, undefined handling,
 * nested objects) so we use a canonical form: sort object keys, drop
 * `undefined`, and string-compact. SHA-256 of that string is the hash.
 * Exported for the unit test and for the `withIdempotency` middleware
 * to call before claiming the key.
 */
export function computeRequestHash(body: unknown): string {
  return createHash('sha256')
    .update(canonicalize(body))
    .digest('hex');
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  // Plain object: sort keys, drop undefined.
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') +
    '}'
  );
}

/**
 * AUDIT FIX (workflows N-liveness): a PROCESSING claim older than this is
 * considered dead (owner crashed between claim and complete/fail) and may
 * be stolen by a new caller. 5 minutes covers any legitimate handler while
 * converting "bricked for the whole TTL after one crash" into a normal retry.
 */
export const IDEMPOTENCY_STEAL_AFTER_MS = 5 * 60 * 1000;

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

export type IdempotencyResult =
  | { status: 'completed'; response: any }
  | { status: 'processing' }
  | { status: 'not_found' }
  // 9.5+ Hardening §10 (T-9P0-7): the supplied Idempotency-Key was
  // previously used for a request with a different body. The caller
  // MUST return 409 IDEMPOTENCY_CONFLICT and NOT replay the cached
  // response. This closes a subtle correctness hole where a key can
  // otherwise be reused for a different operation.
  | { status: 'conflict' };

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
  ttlSeconds: number = 86400,
  // 9.5+ Hardening §10 (T-9P0-7): optional request-body fingerprint.
  // When provided, the function compares it against the stored
  // requestHash on existing rows. A mismatch returns 'conflict'
  // (caller surfaces 409 IDEMPOTENCY_CONFLICT) instead of replaying
  // the cached response. Existing callers that pass no hash keep
  // the legacy behavior.
  requestHash?: string
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
      select: {
        status: true,
        response: true,
        expiresAt: true,
        createdAt: true,
        requestHash: true,
      },
    });

    if (!row) {
      // Race: another request may have deleted the row — treat as processing
      return { status: 'processing' };
    }

    // 9.5+ Hardening §10 (T-9P0-7): same key + different body -> conflict.
    // The rule:
    //   - Caller supplied a hash AND the row has a hash AND they differ
    //     -> 'conflict' (caller returns 409).
    //   - Caller supplied a hash but the row has none (legacy row) ->
    //     treat as 'completed' and return the cached response. The legacy
    //     row was created before the migration; the safest fallback is
    //     the pre-migration behavior.
    //   - Caller did not supply a hash -> legacy behavior (no conflict
    //     check). This is the path existing callers hit.
    if (requestHash && row.requestHash && requestHash !== row.requestHash) {
      logger.warn(
        '[Idempotency] request hash mismatch on reused key (T-9P0-7)',
        { key },
      );
      return { status: 'conflict' };
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

      case 'PROCESSING': {
        // AUDIT FIX (workflows N-liveness): stale-claim stealing. If the
        // claim is older than IDEMPOTENCY_STEAL_AFTER_MS and still
        // PROCESSING, the owning process almost certainly died before it
        // could complete/fail. Steal atomically (deleteMany CAS on
        // updatedAt so concurrent stealers race safely) and give the
        // caller a fresh chance instead of blocking for the whole TTL.
        const claimedAt = row.createdAt?.getTime() ?? 0;
        const ageMs = Date.now() - claimedAt;
        if (ageMs > IDEMPOTENCY_STEAL_AFTER_MS) {
          const stolen = await db.idempotencyKey
            .deleteMany({
              where: { key, status: 'PROCESSING', createdAt: row.createdAt },
            })
            .catch(() => ({ count: 0 }));
          if (stolen.count > 0) {
            logger.warn('[Idempotency] Stole stale PROCESSING claim', {
              key,
              ageMs,
            });
            memoryStore.delete(key);
            return checkOrClaimIdempotency(key, ttlSeconds);
          }
        }
        // Genuinely in-flight (or another stealer won the race) — caller
        // treats this as 409 Conflict and either polls or surfaces an error.
        return { status: 'processing' };
      }

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
  ttlSeconds: number = 86400,
  // 9.5+ Hardening §10 (T-9P0-7): optionally persist the request
  // hash alongside the cached response. Subsequent calls with the
  // same key but a different hash will be rejected as
  // IDEMPOTENCY_CONFLICT.
  requestHash?: string
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
        requestHash: requestHash ?? null,
      },
      update: {
        status: 'COMPLETED',
        response: responseStr,
        expiresAt,
        // Don't clobber an existing requestHash on update — it
        // would let a re-completion of a conflict-path row appear
        // to match a different body.
        ...(requestHash ? { requestHash } : {}),
      },
    });
  } catch (err: unknown) {
    logger.error(`[Idempotency] Failed to save to DB: ${(err instanceof Error ? err.message : String(err))}`);
  }

  // 2. Write to memory store as hot cache / fallback.
  // AUDIT FIX (workflows N-memory): cap retained responses — previously
  // every complete response was mirrored into heap for the full TTL
  // regardless of size (traffic-proportional retention of potentially
  // PII-bearing payloads).
  if (responseStr.length <= 64 * 1024) {
    memoryStore.set(key, {
      response,
      expiresAt: expiresAt.getTime(),
    });
  }
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
  ttlSeconds: number = 86400,
  requestHash?: string
): Promise<void> {
  await completeIdempotency(key, response, ttlSeconds, requestHash);
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
