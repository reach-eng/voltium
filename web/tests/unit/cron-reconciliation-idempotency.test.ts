/**
 * PR-90 (API N10) — cron/reconciliation idempotency.
 *
 * Verifies the race-safety guarantees of the GET handler at
 * `web/src/app/api/cron/reconciliation/route.ts`:
 *   1. A second tick on the same day returns the existing report
 *      (no work, no error).
 *   2. If a concurrent write loses the unique-index race, the route
 *      catches the P2002 and returns the winning row instead of
 *      bubbling a 500.
 *   3. Any other (non-P2002) write error is still surfaced as 500.
 *
 * The DB-side unique constraint is verified by the migration
 * `20260804000000_reconciliation_report_unique_date` (idempotent
 * `CREATE UNIQUE INDEX IF NOT EXISTS`). The Prisma `@unique` is
 * also asserted on the `ReconciliationReport` model by the migration
 * index name.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/cron-auth', () => ({
  requireCronAuth: vi.fn().mockReturnValue(null),
}));

const findUniqueMock = vi.fn();
const runMock = vi.fn();
const recordMock = vi.fn();
const formatDateMock = vi.fn(() => '04-08-2026');

vi.mock('@/server/workers/jobs/wallet-reconciliation.job', () => ({
  checkReconciliationToday: findUniqueMock,
  runWalletReconciliation: runMock,
  recordReconciliation: recordMock,
}));

vi.mock('@/lib/date-utils', () => ({
  formatDateDDMMYYYY: formatDateMock,
  formatDateTimeDDMMYYYY: (v: any) => (v instanceof Date ? v.toISOString() : String(v)),
}));

const { GET } = await import('@/app/api/cron/reconciliation/route');

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/cron/reconciliation', { method: 'GET' });
}

async function callGet() {
  return GET(makeReq());
}

describe('GET /api/cron/reconciliation — PR-90 (API N10) idempotency', () => {
  beforeEach(() => {
    // Full reset — clearAllMocks only wipes call history, not queued
    // return values. The route under test calls the mocked
    // `checkReconciliationToday` either once or twice depending on
    // the success path, so each test must own its queue from zero.
    findUniqueMock.mockReset();
    runMock.mockReset();
    recordMock.mockReset();
    formatDateMock.mockReset();
    formatDateMock.mockReturnValue('04-08-2026');
  });

  it('returns the existing report without running the job when one is already on file for the day', async () => {
    const existing = {
      id: 'r-existing',
      reportDate: '04-08-2026',
      totalWallets: 100,
      matched: 100,
      mismatched: 0,
      drift: 0,
      createdAt: new Date('2026-08-04T02:00:00Z'),
    };
    findUniqueMock.mockResolvedValue(existing);

    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('r-existing');
    expect(body.message).toMatch(/already run/i);
    expect(runMock).not.toHaveBeenCalled();
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('runs the reconciliation when no report exists for the day', async () => {
    findUniqueMock
      .mockResolvedValueOnce(null) // pre-check
      .mockResolvedValueOnce(null); // post-P2002 winner lookup
    runMock.mockResolvedValue({
      totalWallets: 50,
      healthy: 50,
      drifted: 0,
      totalDrift: 0,
      driftedRiders: [],
    });
    recordMock.mockResolvedValue(undefined);

    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reportDate).toBe('04-08-2026');
    expect(body.data.totalWallets).toBe(50);
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(recordMock).toHaveBeenCalledTimes(1);
  });

  it('returns the existing report when recordReconciliation throws P2002 (concurrent tick)', async () => {
    const winner = {
      id: 'r-winner',
      reportDate: '04-08-2026',
      totalWallets: 100,
      matched: 100,
      mismatched: 0,
      drift: 0,
      createdAt: new Date('2026-08-04T02:00:00Z'),
    };
    findUniqueMock
      .mockResolvedValueOnce(null) // pre-check passes
      .mockResolvedValueOnce(winner); // post-P2002 winner lookup
    runMock.mockResolvedValue({
      totalWallets: 100,
      healthy: 100,
      drifted: 0,
      totalDrift: 0,
      driftedRiders: [],
    });
    const p2002 = new Error('Unique constraint failed on the fields: (`reportDate`)');
    (p2002 as any).code = 'P2002';
    recordMock.mockRejectedValue(p2002);

    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('r-winner');
    expect(body.message).toMatch(/already run/i);
  });

  it('still surfaces a 500 when a non-P2002 error escapes recordReconciliation', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    runMock.mockResolvedValue({
      totalWallets: 100,
      healthy: 100,
      drifted: 0,
      totalDrift: 0,
      driftedRiders: [],
    });
    recordMock.mockRejectedValue(new Error('connection terminated unexpectedly: internal-stack-trace'));

    const res = await callGet();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/connection terminated/);
    expect(text).not.toMatch(/internal-stack-trace/);
    expect(text).toMatch(/Reconciliation failed/);
  });

  it('returns a 500 with a generic body when runWalletReconciliation throws', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    runMock.mockRejectedValue(new Error('sensitive: db password=secret123'));
    const res = await callGet();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/password/);
    expect(text).not.toMatch(/secret123/);
    expect(text).toMatch(/Reconciliation failed/);
  });
});
