/**
 * ADMIN_FINANCE_AUDIT_2026-08-05 P0-3 + ADMIN_FINANCIAL_FLOWS_AUDIT_2026-08-05
 * — regression guard for the bulk transaction pre-flight.
 *
 * The route now pre-flights the IDs to partition them into PENDING
 * (processed) vs already-processed (skipped). Previously a single errored
 * ID returned 200 with a green toast and a per-id ERROR row that
 * looked like a success. The new contract:
 *   - 200 OK: all IDs succeeded (zero failed, zero skipped)
 *   - 207 Multi-Status: any ID failed OR skipped
 *   - The response body includes `succeeded`, `failed`, `skipped` counts
 *     plus the per-id `results` array.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  hasPermission: vi.fn(),
  approveTransaction: vi.fn(),
  invalidateCache: vi.fn(),
  isPermissionDenied: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));
vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ hasPermission: mocks.hasPermission }));
vi.mock('@/server/modules/transactions/transaction.use-cases', () => ({
  transactionUseCases: { approveTransaction: mocks.approveTransaction },
  TransactionError: class TransactionError extends Error {
    code: string;
    constructor(message: string, code = 'TRANSACTION_ERROR') {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock('@/lib/cache', () => ({ invalidateCache: mocks.invalidateCache }));
vi.mock('@/lib/api-middleware', () => ({
  withIdempotency: (h: (req: NextRequest) => Promise<Response>) => h,
  isPermissionDenied: (err: unknown) =>
    !!err && typeof err === 'object' && (err as { code?: string }).code === 'PERMISSION_DENIED',
}));
vi.mock('@/lib/services/wallet-service', () => ({}));
vi.mock('@/lib/flatten-rider', () => ({ paiseToRupees: (n: number) => n / 100 }));

// Stub the db module with a findMany that returns rows by id. Use
// vi.hoisted so the factory and the test body share the same stub.
const dbStub = vi.hoisted(() => {
  const rowsById = new Map<string, { id: string; status: string }>();
  const findManyImpl = (args: { where?: { id?: { in?: string[] } } }) => {
    const ids: string[] = args?.where?.id?.in ?? [];
    return ids
      .map((id) => rowsById.get(id))
      .filter((r): r is { id: string; status: string } => !!r);
  };
  return {
    db: {
      transaction: {
        findMany: vi.fn(findManyImpl),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
        deleteMany: vi.fn(),
        findUnique: vi.fn(),
      },
    },
    setRows: (rows: Array<{ id: string; status: string }>) => {
      rowsById.clear();
      for (const r of rows) rowsById.set(r.id, r);
    },
  };
});

vi.mock('@/lib/db', () => ({ db: dbStub.db }));

const { setRows } = dbStub;
import { POST as BULK_POST } from '@/app/api/admin/transactions/bulk/route';

async function postBulk(body: Record<string, unknown>): Promise<Response> {
  return BULK_POST(
    new NextRequest('http://localhost/api/admin/transactions/bulk', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );
}

const financeSession = {
  adminId: 'admin_1',
  adminRole: 'FINANCE_ADMIN',
  role: 'admin',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue(financeSession);
  mocks.hasPermission.mockReturnValue(true);
});

describe('P0-3 (ADMIN_FINANCE + ADMIN_FINANCIAL_FLOWS): bulk route pre-flight + skipped', () => {
  it('skipped (already APPROVED) returns a skipped entry, not ERROR', async () => {
    setRows([
      { id: 'a', status: 'APPROVED' },
      { id: 'b', status: 'PENDING' },
    ]);
    mocks.approveTransaction.mockResolvedValue({ id: 'b', status: 'APPROVED' });

    const res = await postBulk({ ids: ['a', 'b'], action: 'approve' });
    expect(res.status).toBe(207); // mixed (skipped + succeeded)
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.succeeded).toBe(1);
    expect(body.data.failed).toBe(0);
    expect(body.data.skipped).toBe(1);
    const a = body.data.results.find((r: { id: string }) => r.id === 'a');
    const b = body.data.results.find((r: { id: string }) => r.id === 'b');
    expect(a).toMatchObject({ id: 'a', status: 'APPROVED' });
    expect(b).toMatchObject({ id: 'b', status: 'APPROVED' });
  });

  it('all-succeeded returns 200 with zero failed and zero skipped', async () => {
    setRows([
      { id: 'a', status: 'PENDING' },
      { id: 'b', status: 'PENDING' },
    ]);
    mocks.approveTransaction.mockResolvedValue({ id: 'a', status: 'APPROVED' });

    const res = await postBulk({ ids: ['a', 'b'], action: 'approve' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.succeeded).toBe(2);
    expect(body.data.failed).toBe(0);
    expect(body.data.skipped).toBe(0);
  });

  it('not_found: ID not in DB → per-id ERROR, not silent skip', async () => {
    setRows([]); // no rows
    mocks.approveTransaction.mockRejectedValue(new Error('Transaction not found'));

    const res = await postBulk({ ids: ['ghost'], action: 'approve' });
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.data.succeeded).toBe(0);
    expect(body.data.failed).toBe(1);
    expect(body.data.skipped).toBe(0);
    const ghost = body.data.results.find((r: { id: string }) => r.id === 'ghost');
    expect(ghost).toMatchObject({ id: 'ghost', status: 'ERROR' });
  });

  it('mixed: not_found + skipped + succeeded returns 207 with all three counts', async () => {
    setRows([{ id: 'processed', status: 'APPROVED' }]);
    mocks.approveTransaction.mockImplementation(
      async ({ transactionId }: { transactionId: string }) => {
        if (transactionId === 'valid') return { id: 'valid', status: 'APPROVED' };
        throw new Error('Transaction not found');
      }
    );

    const res = await postBulk({
      ids: ['processed', 'valid', 'ghost'],
      action: 'approve',
    });
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.data.succeeded).toBe(1);
    expect(body.data.failed).toBe(1);
    expect(body.data.skipped).toBe(1);
  });
});
