/**
 * PR-89 (API N6) — admin wallet-adjust DEBIT caps + co-admin approval.
 *
 * Verifies the three N6 hard rules in the route:
 *   1. DEBIT above MAX_ADMIN_DEBIT_INR is rejected with 400.
 *   2. DEBIT above LARGE_DEBIT_THRESHOLD_INR without coAdminId is 400.
 *   3. DEBIT above LARGE_DEBIT_THRESHOLD_INR with a valid coAdminId
 *      succeeds.
 *
 * AUDIT-RECON 2026-09-02 batch 5 P0-1: also covers the per-day
 * aggregate DEBIT cap (MAX_ADMIN_DEBIT_PER_DAY_INR). A determined
 * admin could otherwise issue unlimited back-to-back ₹50k debits
 * as long as each is under the per-call cap.
 *
 * Other surface area is covered in `wallet-audit-fixes.test.ts`; this
 * file focuses on the cap + co-admin gate that did not exist before
 * PR-89.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Test the route through the env module. We mock the env so the
// production defaults (₹50,000 cap, ₹10,000 large threshold) are
// active, mirroring the .env.example wiring.
vi.mock('@/lib/env', () => ({
  env: {
    MAX_ADMIN_DEBIT_INR: 50000,
    LARGE_DEBIT_THRESHOLD_INR: 10000,
    MAX_ADMIN_DEBIT_PER_DAY_INR: 200000,
  },
}));

// Session that passes the `riders_update` permission check.
const SESSION = {
  riderDbId: 'admin-1',
  adminId: 'admin-1',
  role: 'admin',
  adminRole: 'SUPER_ADMIN',
};

vi.mock('@/lib/get-session', () => ({
  getAdminSession: vi.fn().mockResolvedValue(SESSION),
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

// DB mocks — all operations return the minimum shape the route reads.
const mockRider = {
  id: 'rider-1',
  lifecycleStatus: 'ACTIVE',
  deletedAt: null,
};

const mockAdmin = {
  id: 'co-admin-2',
  isActive: true,
};

let createdTxn: any = null;
let ledgerCalled: any = null;
// AUDIT-RECON 2026-09-02 batch 5 P0-1: aggregate mock for the per-day
// cap. Defaults to 0 (no prior debits today); per-test override lets
// us simulate a near-cap admin.
let todayDebitPaise: number = 0;

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: vi.fn(),
    },
    admin: {
      findUnique: vi.fn(),
    },
    transaction: {
      aggregate: vi.fn(async () => ({
        _sum: { amountInPaise: todayDebitPaise },
      })),
    },
    $transaction: vi.fn(async (cb: any) => {
      const fakeTx = {
        transaction: {
          create: vi.fn(async (args: any) => {
            createdTxn = {
              id: 'txn-1',
              ...args.data,
            };
            return createdTxn;
          }),
        },
        wallet: {
          findUnique: vi.fn(async () => ({ balanceInPaise: 100000 })),
        },
      };
      // Provide a ledger service surface that the route can call.
      (fakeTx as any).__credit = (args: any) => {
        ledgerCalled = { type: 'CREDIT', args };
      };
      (fakeTx as any).__debit = (args: any) => {
        ledgerCalled = { type: 'DEBIT', args };
      };
      return cb(fakeTx);
    }),
  },
}));

vi.mock('@/server/modules/wallet/wallet-ledger.service', () => ({
  walletLedgerService: {
    credit: vi.fn(async (args: any) => {
      ledgerCalled = { type: 'CREDIT', args };
    }),
    debit: vi.fn(async (args: any) => {
      ledgerCalled = { type: 'DEBIT', args };
    }),
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { POST } = await import('@/app/api/admin/riders/[id]/wallet-adjust/route');
const { db } = await import('@/lib/db');

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/riders/rider-1/wallet-adjust', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

async function callPost(body: unknown) {
  const params = Promise.resolve({ id: 'rider-1' });
  return POST(makeReq(body), { params });
}

describe('POST /api/admin/riders/[id]/wallet-adjust — PR-89 (API N6) caps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdTxn = null;
    ledgerCalled = null;
    todayDebitPaise = 0;
    (db.rider.findUnique as any).mockResolvedValue(mockRider);
    (db.admin.findUnique as any).mockResolvedValue(mockAdmin);
  });

  it('rejects DEBIT above MAX_ADMIN_DEBIT_INR (₹50,000) with 400', async () => {
    const res = await callPost({
      type: 'DEBIT',
      amount: 60000,
      reason: 'Charging a six-figure late-fee penalty that exceeds the cap',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.message).toMatch(/exceeds maximum allowed admin debit limit/i);
    expect((db as any).$transaction).not.toHaveBeenCalled();
  });

  it('rejects DEBIT above the threshold (₹10,000) without coAdminId with 400', async () => {
    const res = await callPost({
      type: 'DEBIT',
      amount: 15000,
      reason: 'Large adjustment without a second admin on the request',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.message).toMatch(/require a coAdminId/i);
    expect((db as any).$transaction).not.toHaveBeenCalled();
  });

  it('rejects DEBIT above threshold when coAdminId refers to an inactive admin with 403', async () => {
    (db.admin.findUnique as any).mockResolvedValue({ id: 'co-admin-2', isActive: false });
    const res = await callPost({
      type: 'DEBIT',
      amount: 15000,
      reason: 'Co-approver is no longer active',
      coAdminId: 'co-admin-2',
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.message).toMatch(/not refer to an active admin/i);
  });

  it('rejects DEBIT above threshold when coAdminId matches the acting admin with 400', async () => {
    const res = await callPost({
      type: 'DEBIT',
      amount: 15000,
      reason: 'Self-approval should be rejected even if a coAdminId is sent',
      coAdminId: SESSION.adminId,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.message).toMatch(/must differ from the acting admin/i);
  });

  it('accepts DEBIT above threshold with a valid coAdminId', async () => {
    const res = await callPost({
      type: 'DEBIT',
      amount: 15000,
      reason: 'Refunding a duplicate rent auto-debit',
      coAdminId: 'co-admin-2',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(ledgerCalled?.type).toBe('DEBIT');
    expect(ledgerCalled?.args.amountInPaise).toBe(1_500_000);
    expect(createdTxn?.id).toBe('txn-1');
  });

  it('rejects DEBIT with reason shorter than 10 characters', async () => {
    const res = await callPost({
      type: 'DEBIT',
      amount: 100,
      reason: 'short',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.message).toMatch(/at least 10 characters/i);
  });

  it('rejects DEBIT for a SUSPENDED rider with 403', async () => {
    (db.rider.findUnique as any).mockResolvedValue({
      id: 'rider-1',
      lifecycleStatus: 'SUSPENDED',
      deletedAt: null,
    });
    const res = await callPost({
      type: 'DEBIT',
      amount: 100,
      reason: 'Even a small debit on a suspended rider must be blocked',
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.message).toMatch(/SUSPENDED/i);
  });

  it('rejects DEBIT for a CLOSED rider with 403', async () => {
    (db.rider.findUnique as any).mockResolvedValue({
      id: 'rider-1',
      lifecycleStatus: 'CLOSED',
      deletedAt: null,
    });
    const res = await callPost({
      type: 'DEBIT',
      amount: 100,
      reason: 'Closed accounts must not be debited from the admin route',
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.message).toMatch(/CLOSED/i);
  });

  it('rejects unknown fields on the body (schema is .strict())', async () => {
    const res = await callPost({
      type: 'DEBIT',
      amount: 100,
      reason: 'An attempt to slip an unknown key into the request',
      sneaky: 'value',
    });
    expect(res.status).toBe(422);
  });

  it('allows a small DEBIT (under threshold) with no coAdminId', async () => {
    const res = await callPost({
      type: 'DEBIT',
      amount: 500,
      reason: 'Standard late-fee adjustment under the threshold',
    });
    expect(res.status).toBe(200);
    expect(ledgerCalled?.type).toBe('DEBIT');
  });

  // AUDIT-RECON 2026-09-02 batch 5 P0-1: per-day aggregate cap.
  // Default per-day cap is ₹2,00,000 (= 20,000,000 paise). Each test
  // sets todayDebitPaise directly to simulate the admin's prior
  // activity without needing a real DB.
  it('rejects DEBIT when today + this request exceed the per-day cap', async () => {
    todayDebitPaise = 19_000_000; // ₹1,90,000 already today
    const res = await callPost({
      type: 'DEBIT',
      amount: 50000, // this request would push to ₹2,40,000 > ₹2,00,000 cap
      reason: 'A back-to-back debit that would push the admin over the daily ceiling',
      coAdminId: 'co-admin-2', // even co-approval does not bypass the aggregate cap
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.message).toMatch(/Daily admin debit cap exceeded/i);
    expect((db as any).$transaction).not.toHaveBeenCalled();
  });

  it('allows a DEBIT that lands exactly at the per-day cap (boundary)', async () => {
    todayDebitPaise = 19_500_000; // ₹1,95,000 already today
    const res = await callPost({
      type: 'DEBIT',
      amount: 5000, // this request = ₹50,000, total ₹2,00,000 = exactly at cap
      reason: 'A small debit that lands exactly at the daily ceiling',
    });
    expect(res.status).toBe(200);
    expect(ledgerCalled?.type).toBe('DEBIT');
  });

  it('does not enforce the per-day cap on CREDIT operations', async () => {
    todayDebitPaise = 19_900_000; // near the cap, but irrelevant for CREDIT
    const res = await callPost({
      type: 'CREDIT',
      amount: 50000,
      proofUrl: 'https://example.com/proof.png',
      reason: 'CREDIT is not subject to the per-day DEBIT cap',
    });
    expect(res.status).toBe(200);
    expect(ledgerCalled?.type).toBe('CREDIT');
  });
});
