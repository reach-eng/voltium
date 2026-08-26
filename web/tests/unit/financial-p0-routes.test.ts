/**
 * Financial audit P0 route-level tests.
 *
 * Covers the HTTP surface of the P0 fixes that are cheap to unit test with
 * mocked modules:
 *   - TG-6 (P0-3): bulk route returns 207 Multi-Status when any ID fails
 *   - TG-8 (P0-4): reconciliation route 403s non-finance roles
 *   - TG-9 (P0-4): reconciliation run is attributed to the acting admin
 *   - P0-2: PUT serializes a lost CAS race as 409 (CONFLICT)
 *   - P0-1: over-cap bonus credit surfaces as 400 via the use-case guard
 *   - P0-6: transaction cache key is admin-agnostic and invalidation is
 *     scoped to 'admin:transactions:*'
 *   - P0-7: POST alias runs the same idempotency-wrapped handler
 *   - TG-1/2/3 (P1): single PUT approve / reject / reverse happy paths
 *   - TG-7 (P1): 500-ID bulk semantics + order preservation (P3-20)
 *   - P2-2/P3-21: lowercase bulk action normalized to canonical UPPERCASE
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
  hasPermission: vi.fn(),
  approveTransaction: vi.fn(),
  getOrSetResponse: vi.fn(),
  invalidateCache: vi.fn(),
  runWalletReconciliation: vi.fn(),
  recordReconciliation: vi.fn(),
  persistReconciliationReport: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: mocks.adminForbidden,
}));

vi.mock('@/lib/auth', () => ({ hasPermission: mocks.hasPermission }));

vi.mock('@/lib/cache', () => ({
  getOrSetResponse: mocks.getOrSetResponse,
  invalidateCache: mocks.invalidateCache,
}));

// Identity middleware — the real withIdempotency (DB-backed idempotency
// table) is covered elsewhere; here we exercise the handlers it wraps.
vi.mock('@/lib/api-middleware', () => ({
  withIdempotency: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));

vi.mock('@/server/modules/transactions/transaction.use-cases', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/server/modules/transactions/transaction.use-cases')>();
  return {
    ...actual,
    transactionUseCases: {
      ...actual.transactionUseCases,
      approveTransaction: mocks.approveTransaction,
    },
  };
});

vi.mock('@/server/workers/jobs/wallet-reconciliation.job', () => ({
  runWalletReconciliation: mocks.runWalletReconciliation,
  recordReconciliation: mocks.recordReconciliation,
  // W6 / M-6: admin runs now also persist the daily report row.
  persistReconciliationReport: mocks.persistReconciliationReport,
}));

import { GET as GET_TXN, PUT, POST } from '@/app/api/admin/transactions/route';
import { POST as POST_BULK } from '@/app/api/admin/transactions/bulk/route';
import { GET as GET_RECON } from '@/app/api/admin/reconciliation/route';
import { TransactionError } from '@/server/modules/transactions/transaction.use-cases';

const financeSession = {
  riderId: 'admin-1',
  riderDbId: 'admin-1',
  phone: 'admin@voltium.in',
  role: 'admin',
  adminId: 'admin-1',
  adminRole: 'FINANCE_ADMIN',
};

function txnReq(method: 'PUT' | 'POST', body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/transactions', {
    method,
    body: JSON.stringify(body),
  });
}

describe('PUT /api/admin/transactions — P0-2 CAS + P0-1 cap + P0-6 cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(financeSession);
    mocks.hasPermission.mockReturnValue(true);
  });

  it('serializes a lost CAS race as 409 (P0-2)', async () => {
    mocks.approveTransaction.mockRejectedValue(
      new TransactionError('Transaction was already processed by another admin', 'CONFLICT')
    );

    const res = await PUT(txnReq('PUT', { id: 't1', action: 'APPROVE' }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('rejects an over-cap bonus credit at the schema boundary with 422 (P0-1)', async () => {
    // The schema cap fires before the use-case is ever reached.
    const res = await PUT(
      txnReq('PUT', { id: 't1', action: 'APPROVE', walletCreditAmount: 999999 })
    );

    expect(res.status).toBe(422);
    expect(mocks.approveTransaction).not.toHaveBeenCalled();
  });

  it('surfaces the use-case cap guard as 400 for non-schema callers (P0-1)', async () => {
    // Schema-valid amount, but the use-case guard (defense for bulk/non-
    // schema callers) rejects with a VALIDATION TransactionError → 400.
    mocks.approveTransaction.mockRejectedValue(
      new TransactionError('Bonus credit cannot exceed ₹1,00,000 per transaction', 'VALIDATION')
    );

    const res = await PUT(txnReq('PUT', { id: 't1', action: 'APPROVE', walletCreditAmount: 5000 }));

    expect(res.status).toBe(400);
  });

  it('returns 200 on success and invalidates only the transactions cache (P0-6)', async () => {
    mocks.approveTransaction.mockResolvedValue({ id: 't1', status: 'APPROVED' });

    const res = await PUT(txnReq('PUT', { id: 't1', action: 'APPROVE' }));

    expect(res.status).toBe(200);
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:transactions:*');
    expect(mocks.invalidateCache).not.toHaveBeenCalledWith('admin:*');
  });

  it('POST alias runs the same wrapped handler (P0-7)', async () => {
    mocks.approveTransaction.mockResolvedValue({ id: 't1', status: 'APPROVED' });

    const res = await POST(txnReq('POST', { id: 't1', action: 'APPROVE' }));

    expect(res.status).toBe(200);
    expect(mocks.approveTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/admin/transactions — P0-6 admin-agnostic cache key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(financeSession);
    mocks.hasPermission.mockReturnValue(true);
    mocks.getOrSetResponse.mockResolvedValue({
      transactions: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('cache key does not include the admin id (no per-admin duplicates)', async () => {
    const res = await GET_TXN(
      new NextRequest('http://localhost/api/admin/transactions?status=PENDING&page=1&limit=20')
    );

    expect(res.status).toBe(200);
    const [key] = mocks.getOrSetResponse.mock.calls[0];
    expect(key.startsWith('admin:transactions')).toBe(true);
    expect(String(key)).not.toContain('admin-1');
  });
});

describe('POST /api/admin/transactions/bulk — P0-3 partial failure (TG-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(financeSession);
    mocks.hasPermission.mockReturnValue(true);
  });

  it('returns 207 with a failed count when any ID fails', async () => {
    mocks.approveTransaction
      .mockResolvedValueOnce({ id: 'a', status: 'APPROVED' })
      .mockRejectedValueOnce(new Error('Transaction not found'));

    const res = await POST_BULK(
      new NextRequest('http://localhost/api/admin/transactions/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: ['a', 'b'], action: 'approve' }),
      })
    );

    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.failed).toBe(1);
    expect(body.data.results.find((r: { id: string }) => r.id === 'b')?.status).toBe('ERROR');
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:transactions:*');
  });

  it('returns 200 when every ID succeeds', async () => {
    mocks.approveTransaction.mockResolvedValue({ id: 'x', status: 'APPROVED' });

    const res = await POST_BULK(
      new NextRequest('http://localhost/api/admin/transactions/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: ['a', 'b'], action: 'approve' }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.failed).toBe(0);
  });

  it('returns 401 without an admin session', async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    mocks.adminUnauthorized.mockReturnValue(Response.json({ success: false }, { status: 401 }));

    const res = await POST_BULK(
      new NextRequest('http://localhost/api/admin/transactions/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: ['a'], action: 'approve' }),
      })
    );

    expect(res.status).toBe(401);
  });
});

describe('PUT /api/admin/transactions — single-action happy paths (TG-1/TG-2/TG-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(financeSession);
    mocks.hasPermission.mockReturnValue(true);
  });

  it('approve calls the use-case with the canonical UPPERCASE action (TG-1)', async () => {
    mocks.approveTransaction.mockResolvedValue({ id: 't1', status: 'APPROVED', amount: 100 });

    const res = await PUT(txnReq('PUT', { id: 't1', action: 'APPROVE' }));

    expect(res.status).toBe(200);
    expect(mocks.approveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 't1', action: 'APPROVE' })
    );
  });

  it('reject forwards rejectionReason and reports REJECTED (TG-2)', async () => {
    mocks.approveTransaction.mockResolvedValue({ id: 't1', status: 'REJECTED' });

    const res = await PUT(
      txnReq('PUT', { id: 't1', action: 'REJECT', rejectionReason: 'fake proof' })
    );

    expect(res.status).toBe(200);
    expect(mocks.approveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 't1', action: 'REJECT', rejectionReason: 'fake proof' })
    );
  });

  it('reverse resolves through the use-case and reports REVERSED (TG-3)', async () => {
    mocks.approveTransaction.mockResolvedValue({ id: 't1', status: 'REVERSED' });

    const res = await PUT(txnReq('PUT', { id: 't1', action: 'REVERSE' }));

    expect(res.status).toBe(200);
    expect(mocks.approveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 't1', action: 'REVERSE' })
    );
  });
});

describe('POST /api/admin/transactions/bulk — 500-ID semantics + action normalization (TG-7, P2-2/P3-21)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(financeSession);
    mocks.hasPermission.mockReturnValue(true);
  });

  it('rejects more than 500 IDs with 422 (TG-7)', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`);

    const res = await POST_BULK(
      new NextRequest('http://localhost/api/admin/transactions/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids, action: 'approve' }),
      })
    );

    expect(res.status).toBe(422);
    expect(mocks.approveTransaction).not.toHaveBeenCalled();
  });

  it('processes exactly 500 IDs and preserves response order (TG-7 + P3-20)', async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `id-${i}`);
    mocks.approveTransaction.mockImplementation(async ({ transactionId }) => ({
      id: transactionId,
      status: 'APPROVED',
    }));

    const res = await POST_BULK(
      new NextRequest('http://localhost/api/admin/transactions/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids, action: 'approve' }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.results).toHaveLength(500);
    expect(body.data.results[0].id).toBe('id-0');
    expect(body.data.results[499].id).toBe('id-499');
    expect(mocks.approveTransaction).toHaveBeenCalledTimes(500);
  });

  it('lowercase reject action is normalized to canonical REJECT (P2-2/P3-21)', async () => {
    mocks.approveTransaction.mockResolvedValue({ id: 'a', status: 'REJECTED' });

    const res = await POST_BULK(
      new NextRequest('http://localhost/api/admin/transactions/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: ['a'], action: 'reject', rejectionReason: 'test reject' }),
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.approveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 'a', action: 'REJECT' })
    );
  });
});

describe('GET /api/admin/reconciliation — P0-4 permission + attribution (TG-8/TG-9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runWalletReconciliation.mockResolvedValue({
      totalWallets: 5,
      healthy: 5,
      drifted: 0,
      totalDrift: 0,
      totalWalletSum: 0,
      totalLedgerSum: 0,
      driftedRiders: [],
    });
    mocks.recordReconciliation.mockResolvedValue(undefined);
  });

  it('403s a READ_ONLY admin (TG-8)', async () => {
    mocks.requireAdmin.mockResolvedValue({ ...financeSession, adminRole: 'READ_ONLY' });
    mocks.hasPermission.mockReturnValue(false);

    const res = await GET_RECON(new NextRequest('http://localhost/api/admin/reconciliation'));

    expect(res.status).toBe(403);
    expect(mocks.runWalletReconciliation).not.toHaveBeenCalled();
    expect(mocks.recordReconciliation).not.toHaveBeenCalled();
  });

  it('runs for a FINANCE_ADMIN and attributes the run to them (TG-9)', async () => {
    mocks.requireAdmin.mockResolvedValue(financeSession);
    mocks.hasPermission.mockReturnValue(true);

    const res = await GET_RECON(new NextRequest('http://localhost/api/admin/reconciliation'));

    expect(res.status).toBe(200);
    expect(mocks.recordReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({ totalWallets: 5 }),
      { actorId: 'admin-1' }
    );
  });

  it('401s without an admin session', async () => {
    mocks.requireAdmin.mockResolvedValue(null);

    const res = await GET_RECON(new NextRequest('http://localhost/api/admin/reconciliation'));

    expect(res.status).toBe(401);
    expect(mocks.runWalletReconciliation).not.toHaveBeenCalled();
  });
});
