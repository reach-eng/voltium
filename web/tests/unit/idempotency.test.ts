/**
 * Tests for src/lib/idempotency.ts (Phase 3.3).
 *
 * Verifies the atomic check-and-claim contract:
 *  - First call returns `not_found` and creates a row.
 *  - Second concurrent call returns `processing`.
 *  - After `completeIdempotency`, the next call returns `completed`
 *    with the cached response.
 *  - `failIdempotency` resets the key so the next call returns
 *    `not_found` again.
 *  - Expired keys are removed and a fresh claim succeeds.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks (vi.hoisted for hoisting above imports).
const mocks = vi.hoisted(() => {
  const idemStore = new Map<
    string,
    { status: string; response: string | null; expiresAt: Date }
  >();
  return {
    idemStore,
    insert: vi.fn(async (key: string, expiresAt: Date) => {
      if (idemStore.has(key)) return 0;
      idemStore.set(key, {
        status: 'PROCESSING',
        response: null,
        expiresAt,
      });
      return 1;
    }),
    find: vi.fn(async (key: string) => idemStore.get(key) ?? null),
      upsert: vi.fn(
        async (
          key: string,
          status: string,
          response: string | null,
          expiresAt: Date
        ) => {
          // The new values override any pre-existing fields, so
          // order is: existing first, then new values.
          const existing = idemStore.get(key);
          idemStore.set(key, {
            ...(existing ?? {}),
            status,
            response,
            expiresAt,
          });
        }
      ),
    update: vi.fn(async (key: string, status: string) => {
      const row = idemStore.get(key);
      if (row) idemStore.set(key, { ...row, status });
    }),
    delete: vi.fn(async (key: string) => {
      idemStore.delete(key);
    }),
    deleteMany: vi.fn(async () => ({ count: 0 })),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
  db: {
    $executeRawUnsafe: vi.fn(async (sql: string, key: string, expiresAt: Date) => {
      // Mimic the INSERT ... ON CONFLICT DO NOTHING used in the lib.
      if (sql.startsWith('INSERT')) {
        return mocks.insert(key, expiresAt);
      }
      return 0;
    }),
    idempotencyKey: {
      findUnique: vi.fn(async ({ where }: any) => {
        const row = await mocks.find(where.key);
        if (!row) return null;
        return {
          status: row.status,
          response: row.response,
          expiresAt: row.expiresAt,
        };
      }),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: any) => {
        const existing = idemStoreGet(where.key);
        if (existing) {
          // Mimic Prisma upsert: apply `update` fields over the
          // existing row, falling back to `create` fields for any
          // missing keys. This is important for the COMPLETED case
          // where `update.status = 'COMPLETED'` and `update.response`
          // must overwrite the PROCESSING row.
          const merged = {
            ...existing,
            ...create,
            ...update,
          };
          await mocks.upsert(
            where.key,
            merged.status,
            merged.response ?? null,
            merged.expiresAt
          );
        } else {
          await mocks.upsert(
            where.key,
            create.status,
            create.response,
            create.expiresAt
          );
        }
      }
    ),
      update: vi.fn(async ({ where, data }: any) => {
        await mocks.update(where.key, data.status);
      }),
      delete: vi.fn(async ({ where }: any) => {
        await mocks.delete(where.key);
      }),
      deleteMany: vi.fn(async () => mocks.deleteMany()),
    },
  },
}));

// Local helper used by the mock (must be defined at module scope).
const idemStoreGet = (key: string) => mocks.idemStore.get(key) ?? null;

import {
  checkOrClaimIdempotency,
  completeIdempotency,
  failIdempotency,
  purgeExpiredIdempotencyKeys,
} from '@/lib/idempotency';

beforeEach(() => {
  mocks.idemStore.clear();
  vi.clearAllMocks();
});

describe('idempotency (Phase 3.3)', () => {
  it('first call returns not_found and inserts a PROCESSING row', async () => {
    const r = await checkOrClaimIdempotency('key-1');
    expect(r.status).toBe('not_found');
    expect(mocks.idemStore.get('key-1')?.status).toBe('PROCESSING');
  });

  it('second call before completion returns processing', async () => {
    await checkOrClaimIdempotency('key-1');
    const r = await checkOrClaimIdempotency('key-1');
    expect(r.status).toBe('processing');
  });

  it('after completeIdempotency, next call returns completed with the cached response', async () => {
    await checkOrClaimIdempotency('key-1');
    const response = { ok: true, value: 42 };
    await completeIdempotency('key-1', response);
    const r = await checkOrClaimIdempotency('key-1');
    expect(r.status).toBe('completed');
    if (r.status === 'completed') {
      expect(r.response).toEqual(response);
    }
  });

  it('after failIdempotency, next call returns not_found (caller may retry)', async () => {
    await checkOrClaimIdempotency('key-1');
    await failIdempotency('key-1');
    const r = await checkOrClaimIdempotency('key-1');
    expect(r.status).toBe('not_found');
  });

  it('expired key is purged and a fresh claim succeeds', async () => {
    mocks.idemStore.set('key-1', {
      status: 'COMPLETED',
      response: '{"ok":true}',
      expiresAt: new Date(Date.now() - 60_000), // 1 min ago
    });
    const r = await checkOrClaimIdempotency('key-1');
    expect(r.status).toBe('not_found');
  });

  it('purgeExpiredIdempotencyKeys returns the count from deleteMany', async () => {
    mocks.deleteMany.mockResolvedValueOnce({ count: 5 });
    const n = await purgeExpiredIdempotencyKeys();
    expect(n).toBe(5);
  });

  it('corrupted response in a COMPLETED row is treated as processing', async () => {
    mocks.idemStore.set('key-1', {
      status: 'COMPLETED',
      response: 'not-valid-json',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const r = await checkOrClaimIdempotency('key-1');
    expect(r.status).toBe('processing');
  });
});
