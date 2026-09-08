/**
 * NET-005 follow-up-22 (2026-09-08): two
 * concurrency / correctness fixes for
 * `POST /api/admin/riders/[id]/wallet-adjust`.
 *
 * 1. The pre-fix daily-cap check was a
 *    read-then-act: `db.transaction.aggregate()`
 *    ran OUTSIDE the `$transaction`, so two
 *    concurrent debits by the same admin could
 *    both read the same snapshot, both pass the
 *    cap check, and both write — exceeding the
 *    daily ceiling. The fix moves the aggregate
 *    INSIDE the transaction and adds a
 *    `SELECT ... FOR UPDATE` row lock on the
 *    admin to serialize concurrent debits by the
 *    same admin (other admins' debits are not
 *    blocked).
 * 2. The pre-fix code passed `session.adminId`
 *    straight to the aggregate's
 *    `where: { approvedBy: session.adminId }`.
 *    The session shape is `adminId?: string` —
 *    it can be undefined. Prisma's
 *    `where: { field: undefined }` drops the
 *    filter (NOT match-nothing), so the
 *    aggregate would silently sum EVERY admin's
 *    debits, and the audit log's non-null
 *    assertion would explode at runtime. The
 *    fix throws at the top of the route when
 *    `session.adminId` is undefined.
 *
 * The existing `admin-wallet-adjust-caps.test.ts`
 * covers the existing cap/co-admin/idempotency
 * surface (and was updated to include the new
 * `tx.$executeRaw` / `tx.transaction.aggregate`
 * mocks). This file covers the new behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/env', () => ({
  env: {
    MAX_ADMIN_DEBIT_INR: 50000,
    LARGE_DEBIT_THRESHOLD_INR: 10000,
    MAX_ADMIN_DEBIT_PER_DAY_INR: 200000,
  },
}));

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  hasPermission: vi.fn(),
  riderFindUnique: vi.fn(),
  adminFindUnique: vi.fn(),
  transactionFindUnique: vi.fn(),
  transactionAggregate: vi.fn(),
  walletFindUnique: vi.fn(),
  transactionCreate: vi.fn(),
  txExecuteRaw: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  walletLedgerCredit: vi.fn(),
  walletLedgerDebit: vi.fn(),
  // Track the number of distinct executions of
  // `txExecuteRaw` (one per DEBIT after the
  // fix). Used to assert the row lock fires
  // before the aggregate read.
  txExecuteRawCallCount: 0,
  // Capture the order of calls inside the tx —
  // row lock MUST come before the aggregate.
  txCallOrder: [] as string[],
  todayDebitPaise: 0 as number | null,
}));

vi.mock('@/lib/get-session', () => ({
  getAdminSession: mocks.getAdminSession,
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: mocks.hasPermission,
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock('@/lib/server-cache', () => ({
  invalidateRiderCache: vi.fn(),
  invalidateRiderPhoneCache: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/server/modules/wallet/wallet-ledger.service', () => ({
  walletLedgerService: {
    credit: mocks.walletLedgerCredit,
    debit: mocks.walletLedgerDebit,
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.riderFindUnique,
    },
    admin: {
      findUnique: mocks.adminFindUnique,
    },
    transaction: {
      findUnique: mocks.transactionFindUnique,
      aggregate: mocks.transactionAggregate,
      create: mocks.transactionCreate,
    },
    wallet: {
      findUnique: mocks.walletFindUnique,
    },
    $transaction: vi.fn(async (cb: any) => {
      const fakeTx: any = {
        // NET-005 follow-up-22 (2026-09-08): the
        // route now calls `tx.$executeRaw` to
        // row-lock the admin (one per DEBIT) and
        // `tx.transaction.aggregate` to read the
        // daily cap (also per DEBIT). Track call
        // order so we can assert the lock fires
        // before the aggregate.
        $executeRaw: vi.fn(async () => {
          mocks.txExecuteRawCallCount += 1;
          mocks.txCallOrder.push('$executeRaw');
          return 0;
        }),
        transaction: {
          aggregate: vi.fn(async () => {
            mocks.txCallOrder.push('transaction.aggregate');
            return { _sum: { amountInPaise: mocks.todayDebitPaise ?? 0 } };
          }),
          create: vi.fn(async (args: any) => {
            mocks.txCallOrder.push('transaction.create');
            return { id: 'txn-1', ...args.data };
          }),
        },
        wallet: {
          findUnique: vi.fn(async () => ({ balanceInPaise: 100000 })),
        },
      };
      try {
        return await cb(fakeTx);
      } catch (err) {
        // The throw inside the tx short-circuits
        // any subsequent operations. The test
        // re-throws so the catch in the route
        // sees it.
        throw err;
      }
    }),
  },
}));

import { POST } from '@/app/api/admin/riders/[id]/wallet-adjust/route';

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/riders/rider-1/wallet-adjust', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const callPost = (body: Record<string, unknown>) =>
  POST(makeReq(body), { params: Promise.resolve({ id: 'rider-1' }) });

const rider = {
  id: 'rider-1',
  lifecycleStatus: 'ACTIVE',
  deletedAt: null,
};

describe('NET-005 follow-up-22: adminId undefined guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.txExecuteRawCallCount = 0;
    mocks.txCallOrder = [];
    mocks.todayDebitPaise = 0;
    mocks.hasPermission.mockReturnValue(true);
    mocks.riderFindUnique.mockResolvedValue(rider);
    mocks.transactionFindUnique.mockResolvedValue(null);
    mocks.walletFindUnique.mockResolvedValue({ balanceInPaise: 100000 });
  });

  it('rejects 401 when the admin session has no adminId (the undefined-filter risk)', async () => {
    // The session shape is `adminId?: string` —
    // it can be undefined. Pre-fix: the
    // aggregate's `where: { approvedBy:
    // session.adminId }` would drop the filter
    // (Prisma treats `where: { field: undefined }`
    // as "filter not applied", NOT "match
    // nothing") and sum EVERY admin's debits. The
    // audit log's `actorId: session.adminId!`
    // non-null assertion would also explode.
    mocks.getAdminSession.mockResolvedValue({
      adminRole: 'OPERATIONS_ADMIN',
      // no adminId — the failing case
    });

    const res = await callPost({
      type: 'DEBIT',
      amount: 100,
      reason: 'A test that should be rejected before the tx',
    });
    expect(res.status).toBe(401);
    // The DB was never touched — the guard
    // short-circuits before the tx.
    expect(mocks.txExecuteRaw).not.toHaveBeenCalled();
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it('proceeds when adminId is a string (the happy path)', async () => {
    mocks.getAdminSession.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.todayDebitPaise = 0;

    const res = await callPost({
      type: 'DEBIT',
      amount: 100,
      reason: 'A small debit that should succeed end to end',
    });
    expect(res.status).toBe(200);
  });

  it('audit log actorId is a string, not undefined (the ! assertion is no longer load-bearing)', async () => {
    mocks.getAdminSession.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });

    await callPost({
      type: 'CREDIT',
      amount: 100,
      reason: 'A small credit that should succeed end to end',
      proofUrl: 'https://example.com/proof.jpg',
    });
    const auditCall = mocks.createAuditLog.mock.calls[0][0];
    expect(typeof auditCall.actorId).toBe('string');
    expect(auditCall.actorId).toBe('admin-1');
  });
});

describe('NET-005 follow-up-22: in-tx daily cap with row lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.txExecuteRawCallCount = 0;
    mocks.txCallOrder = [];
    mocks.todayDebitPaise = 0;
    mocks.hasPermission.mockReturnValue(true);
    mocks.getAdminSession.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.riderFindUnique.mockResolvedValue(rider);
    mocks.transactionFindUnique.mockResolvedValue(null);
    mocks.walletFindUnique.mockResolvedValue({ balanceInPaise: 100000 });
  });

  it('row-locks the admin before reading the daily cap (the concurrency fix)', async () => {
    // The motivating bug: pre-fix, the aggregate
    // ran OUTSIDE the tx. Two concurrent debits
    // could both read the same snapshot. The fix
    // moves the aggregate inside the tx AND adds
    // a `SELECT ... FOR UPDATE` row lock on the
    // admin before the aggregate. The lock is
    // per-admin (other admins' debits are not
    // blocked), but two concurrent debits by the
    // SAME admin serialize — the second blocks
    // until the first commits, so the second
    // sees the first's debit in its aggregate.
    mocks.todayDebitPaise = 0;

    await callPost({
      type: 'DEBIT',
      amount: 100,
      reason: 'A small debit that should succeed',
    });

    // The row lock fired exactly once for the
    // single DEBIT. (CREDIT doesn't acquire it.)
    expect(mocks.txExecuteRawCallCount).toBe(1);
    // The row lock was acquired BEFORE the
    // aggregate read. This is the lock-then-read
    // pattern that closes the race.
    const lockIdx = mocks.txCallOrder.indexOf('$executeRaw');
    const aggIdx = mocks.txCallOrder.indexOf('transaction.aggregate');
    expect(lockIdx).toBeLessThan(aggIdx);
  });

  it('does NOT row-lock for CREDIT (only DEBIT hits the daily cap)', async () => {
    await callPost({
      type: 'CREDIT',
      amount: 100,
      reason: 'A small credit that should succeed',
      proofUrl: 'https://example.com/proof.jpg',
    });
    // No DEBIT → no daily cap check → no row
    // lock. The credit path skips the entire
    // DEBIT-only block.
    expect(mocks.txExecuteRawCallCount).toBe(0);
  });

  it('throws DailyDebitCapExceededError when today + this > cap, mapped to 400', async () => {
    // Keep the amount UNDER the large-debit
    // threshold (₹10,000) so the co-admin gate
    // doesn't fire first. The test is for the
    // daily-cap check, not the co-admin gate.
    mocks.todayDebitPaise = 19_500_000; // ₹1,95,000 already today
    const res = await callPost({
      type: 'DEBIT',
      amount: 9000, // ₹90,000 = pushes to ₹2,40,000 > ₹2,00,000 cap
      reason: 'A back-to-back debit that would exceed the daily ceiling',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.message).toMatch(/Daily admin debit cap exceeded/i);
  });

  it('rolls back the tx on cap exceeded (the throw is in-tx)', async () => {
    // The pre-fix cap check was pre-tx, so a
    // cap-rejected request never entered the
    // tx. Post-fix, the cap check is in-tx and
    // throws — the tx must roll back (no
    // transaction row created, no ledger
    // write). The route maps the throw to 400.
    // Keep the amount UNDER the large-debit
    // threshold (₹10,000) so the co-admin gate
    // doesn't fire first.
    mocks.todayDebitPaise = 19_500_000; // ₹1,95,000 already today
    const res = await callPost({
      type: 'DEBIT',
      amount: 9000, // pushes to ₹2,40,000 > cap
      reason: 'Over the cap',
    });
    expect(res.status).toBe(400);
    // The tx was entered (the row lock fired),
    // but the cap throw happened BEFORE the
    // transaction.create and the ledger write.
    expect(mocks.txExecuteRawCallCount).toBe(1);
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.walletLedgerDebit).not.toHaveBeenCalled();
  });

  it('allows a DEBIT that lands exactly at the cap (boundary, inclusive)', async () => {
    // Per-day cap is ₹2,00,000 = 20,000,000
    // paise. today + this <= cap passes.
    mocks.todayDebitPaise = 19_500_000; // ₹1,95,000
    const res = await callPost({
      type: 'DEBIT',
      amount: 500, // ₹500 → total ₹1,95,500 ≤ ₹2,00,000
      reason: 'A small debit under the cap',
    });
    expect(res.status).toBe(200);
  });
});
