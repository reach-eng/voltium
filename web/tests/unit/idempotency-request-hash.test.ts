/**
 * 9.5+ Hardening §10 (T-9P0-7): idempotency request fingerprint.
 *
 * Pins the contract of `computeRequestHash` and the new
 * `IdempotencyResult.status === 'conflict'` branch of
 * `checkOrClaimIdempotency`. We mock the DB so the test runs
 * without a live dev server.
 *
 * Invariants pinned:
 *   1. computeRequestHash is deterministic: same input -> same hash.
 *   2. Key order in objects does NOT change the hash.
 *   3. `undefined` fields are dropped (so `{a:1}` and `{a:1, b:undefined}`
 *      hash to the same value).
 *   4. Nested objects and arrays are canonicalized.
 *   5. checkOrClaimIdempotency with no hash stays on the legacy
 *      "completed / processing / not_found" path.
 *   6. checkOrClaimIdempotency with a hash on a row that has the
 *      SAME hash returns 'completed' (replay the cached response).
 *   7. checkOrClaimIdempotency with a hash on a row that has a
 *      DIFFERENT hash returns 'conflict' (caller surfaces 409).
 *   8. checkOrClaimIdempotency with a hash on a legacy row (no
 *      stored hash) returns 'completed' (legacy fallback).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Prisma client so the unit test does not need a live DB.
const { mockIdempotencyKey } = vi.hoisted(() => ({
  mockIdempotencyKey: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

const { mockExecuteRawUnsafe } = vi.hoisted(() => ({
  mockExecuteRawUnsafe: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    idempotencyKey: mockIdempotencyKey,
    $executeRawUnsafe: mockExecuteRawUnsafe,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  computeRequestHash,
  checkOrClaimIdempotency,
  type IdempotencyResult,
} from '@/lib/idempotency';

describe('idempotency request fingerprint (9.5+ T-9P0-7)', () => {
  beforeEach(() => {
    mockIdempotencyKey.findUnique.mockReset();
    mockIdempotencyKey.upsert.mockReset();
    mockIdempotencyKey.update.mockReset();
    mockIdempotencyKey.delete.mockReset();
    mockIdempotencyKey.deleteMany.mockReset();
    mockExecuteRawUnsafe.mockReset();
  });

  describe('computeRequestHash', () => {
    it('is deterministic for the same input', () => {
      const a = computeRequestHash({ amount: 100, type: 'CREDIT' });
      const b = computeRequestHash({ amount: 100, type: 'CREDIT' });
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    });

    it('is order-independent for object keys', () => {
      const a = computeRequestHash({ amount: 100, type: 'CREDIT' });
      const b = computeRequestHash({ type: 'CREDIT', amount: 100 });
      expect(a).toBe(b);
    });

    it('drops undefined values (canonical form)', () => {
      const a = computeRequestHash({ amount: 100, type: 'CREDIT' });
      const b = computeRequestHash({
        amount: 100,
        type: 'CREDIT',
        extra: undefined,
      });
      expect(a).toBe(b);
    });

    it('handles nested objects and arrays', () => {
      const a = computeRequestHash({ items: [{ a: 1 }, { a: 2 }] });
      const b = computeRequestHash({ items: [{ a: 1 }, { a: 2 }] });
      expect(a).toBe(b);
      // Order of array elements is preserved.
      const c = computeRequestHash({ items: [{ a: 2 }, { a: 1 }] });
      expect(c).not.toBe(a);
    });

    it('handles primitives', () => {
      expect(computeRequestHash(42)).toBe(computeRequestHash(42));
      expect(computeRequestHash('hello')).toBe(computeRequestHash('hello'));
      expect(computeRequestHash(null)).toBe(computeRequestHash(null));
      // Different values -> different hashes.
      expect(computeRequestHash(42)).not.toBe(computeRequestHash(43));
    });
  });

  describe('checkOrClaimIdempotency with requestHash', () => {
    it('legacy path: no hash argument -> not_found on first claim', async () => {
      mockExecuteRawUnsafe.mockResolvedValueOnce(1); // 1 row inserted -> we own the lock
      const result = await checkOrClaimIdempotency('legacy-key');
      expect(result.status).toBe('not_found');
    });

    it('replay path: same hash on completed row -> completed + response', async () => {
      // First call claims the lock.
      mockExecuteRawUnsafe.mockResolvedValueOnce(0); // 0 rows inserted -> key exists
      // The existing row is COMPLETED with the same hash and a response.
      mockIdempotencyKey.findUnique.mockResolvedValueOnce({
        status: 'COMPLETED',
        response: JSON.stringify({ success: true, data: { id: 'tx-1' } }),
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        requestHash: 'h-abc',
      });
      const result = await checkOrClaimIdempotency('replay-key', 60, 'h-abc');
      expect(result.status).toBe('completed');
      if (result.status === 'completed') {
        expect(result.response).toEqual({ success: true, data: { id: 'tx-1' } });
      }
    });

    it('conflict path: different hash on completed row -> conflict', async () => {
      mockExecuteRawUnsafe.mockResolvedValueOnce(0);
      mockIdempotencyKey.findUnique.mockResolvedValueOnce({
        status: 'COMPLETED',
        response: JSON.stringify({ success: true, data: { id: 'tx-1' } }),
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        requestHash: 'h-original',
      });
      const result = await checkOrClaimIdempotency(
        'reuse-key',
        60,
        'h-different',
      );
      expect(result.status).toBe('conflict');
    });

    it('legacy fallback: hash on caller side, no hash on row -> completed', async () => {
      // The row was created before the migration; treat as legacy
      // and return the cached response (preserves the pre-T-9P0-7
      // behavior for existing rows).
      mockExecuteRawUnsafe.mockResolvedValueOnce(0);
      mockIdempotencyKey.findUnique.mockResolvedValueOnce({
        status: 'COMPLETED',
        response: JSON.stringify({ ok: true }),
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        requestHash: null,
      });
      const result = await checkOrClaimIdempotency(
        'legacy-row',
        60,
        'h-new',
      );
      expect(result.status).toBe('completed');
    });

    it('conflict path is also detected on PROCESSING rows', async () => {
      // Even when the row is still PROCESSING, a hash mismatch must
      // surface as conflict, not as 'processing'. The 9.5+ contract:
      // a reused key with a different body is a client bug either
      // way, but 'conflict' is the more accurate diagnosis.
      mockExecuteRawUnsafe.mockResolvedValueOnce(0);
      mockIdempotencyKey.findUnique.mockResolvedValueOnce({
        status: 'PROCESSING',
        response: null,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        requestHash: 'h-original',
      });
      const result = await checkOrClaimIdempotency(
        'concurrent-key',
        60,
        'h-different',
      );
      expect(result.status).toBe('conflict');
    });
  });
});
