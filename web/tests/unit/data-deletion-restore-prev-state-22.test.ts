/**
 * NET-005 follow-up-22 (2026-09-08): the
 * `data-deletion/restore` route now restores to
 * the rider's PRE-deletion state instead of
 * hard-coding 'ACTIVE'. The pre-deletion state
 * is captured by the execute route in
 * `rider.data_deletion.initiated.details
 * .previousLifecycleStatus` and read by the
 * restore route.
 *
 * The motivating bug: a previously SUSPENDED or
 * RETURN_PENDING rider would come back as ACTIVE.
 * The fix reads the audit log, validates the
 * state-machine transition, and restores to the
 * real state. Falls back to 500 (not a fabricated
 * default) when the audit log is missing or the
 * pre-deletion state was not captured.
 *
 * (The execute-side capture and the state-machine
 * extension are covered by the
 * `data-deletion-state-machine-19.test.ts` and
 * `state-machines.test.ts` files — this file
 * focuses on the restore-side read + write.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  riderFindUnique: vi.fn(),
  auditLogFindFirst: vi.fn(),
  auditLogCreate: vi.fn(),
  riderUpdate: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.riderFindUnique,
      update: mocks.riderUpdate,
    },
    auditLog: {
      findFirst: mocks.auditLogFindFirst,
      create: mocks.auditLogCreate,
    },
  },
}));

vi.mock('@/lib/rbac', () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.auditLogCreate,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/server/modules/riders/rider-lifecycle.service', () => ({
  validateTransition: (current: string, target: string) => {
    const TRANSITIONS: Record<string, string[]> = {
      CLOSED: ['ACTIVE', 'SUSPENDED', 'RETURN_PENDING'],
      ACTIVE: [],
      SUSPENDED: [],
      RETURN_PENDING: [],
    };
    if (current === target) return;
    if (!TRANSITIONS[current]?.includes(target)) {
      throw new Error(
        `Invalid rider lifecycle transition: "${current}" → "${target}"`
      );
    }
  },
  RiderLifecycleError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RiderLifecycleError';
    }
  },
}));

import { POST } from '@/app/api/admin/riders/[id]/data-deletion/restore/route';

const makePostReq = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/riders/r1/data-deletion/restore', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('NET-005 follow-up-22: restore returns to pre-deletion state, not always ACTIVE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({
      adminId: 'admin-1',
    });
    mocks.riderUpdate.mockResolvedValue({});
    mocks.auditLogCreate.mockResolvedValue(undefined);
  });

  it('restores a previously ACTIVE rider to ACTIVE (the happy path)', async () => {
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'CLOSED',
      purgedAt: null,
    });
    mocks.auditLogFindFirst.mockResolvedValue({
      details: JSON.stringify({
        approvalToken: 'tok',
        previousLifecycleStatus: 'ACTIVE',
      }),
    } as any);

    const res = await POST(makePostReq({ requestId: 'r1', reason: 'GDPR rollback' }), {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(200);
    expect(mocks.riderUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { lifecycleStatus: 'ACTIVE', deletedAt: null },
    });
  });

  it('restores a previously SUSPENDED rider to SUSPENDED (not ACTIVE — the documented bug)', async () => {
    // The pre-fix code hard-coded 'ACTIVE'. A
    // SUSPENDED rider would have come back as
    // ACTIVE — the rider could now legally start
    // a rental, which they couldn't before. The fix
    // restores to SUSPENDED.
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'CLOSED',
      purgedAt: null,
    });
    mocks.auditLogFindFirst.mockResolvedValue({
      details: JSON.stringify({
        approvalToken: 'tok',
        previousLifecycleStatus: 'SUSPENDED',
      }),
    } as any);

    const res = await POST(makePostReq({ requestId: 'r1', reason: 'GDPR rollback' }), {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(200);
    expect(mocks.riderUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { lifecycleStatus: 'SUSPENDED', deletedAt: null },
    });
  });

  it('restores a previously RETURN_PENDING rider to RETURN_PENDING', async () => {
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'CLOSED',
      purgedAt: null,
    });
    mocks.auditLogFindFirst.mockResolvedValue({
      details: JSON.stringify({
        approvalToken: 'tok',
        previousLifecycleStatus: 'RETURN_PENDING',
      }),
    } as any);

    const res = await POST(makePostReq({ requestId: 'r1', reason: 'GDPR rollback' }), {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(200);
    expect(mocks.riderUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { lifecycleStatus: 'RETURN_PENDING', deletedAt: null },
    });
  });

  it('rejects with 500 when no audit row is found (refuse to fabricate state)', async () => {
    // The audit log is the source of truth for the
    // pre-deletion state. If it's missing, we
    // can't restore — the right answer is to fail
    // loud (not to guess).
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'CLOSED',
      purgedAt: null,
    });
    mocks.auditLogFindFirst.mockResolvedValue(null);

    const res = await POST(makePostReq({ requestId: 'r1', reason: 'GDPR rollback' }), {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(500);
    // No DB write — the route short-circuits
    // before touching the rider.
    expect(mocks.riderUpdate).not.toHaveBeenCalled();
  });

  it('rejects with 500 when the audit row exists but previousLifecycleStatus is missing (the pre-fix execute path)', async () => {
    // The pre-fix execute route didn't capture
    // `previousLifecycleStatus`. An audit row from
    // a pre-fix run is missing the field. Refuse
    // to guess — the operator must investigate.
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'CLOSED',
      purgedAt: null,
    });
    mocks.auditLogFindFirst.mockResolvedValue({
      // details exists but does NOT include
      // previousLifecycleStatus — the pre-fix
      // capture path didn't write it.
      details: JSON.stringify({ approvalToken: 'tok' }),
    } as any);

    const res = await POST(makePostReq({ requestId: 'r1', reason: 'GDPR rollback' }), {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(500);
    expect(mocks.riderUpdate).not.toHaveBeenCalled();
  });

  it('rejects with 500 when the captured previousLifecycleStatus is not a legal restore target', async () => {
    // Defense-in-depth: the execute-side validates
    // the source state is {ACTIVE, SUSPENDED,
    // RETURN_PENDING}, but a future regression
    // could let a pre-active state through. The
    // state machine rejects with RiderLifecycleError
    // (mapped to 500 by the route's catch — same
    // defense-in-depth pattern as the
    // data-deletion execute route).
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'CLOSED',
      purgedAt: null,
    });
    mocks.auditLogFindFirst.mockResolvedValue({
      details: JSON.stringify({
        approvalToken: 'tok',
        previousLifecycleStatus: 'NEW', // pre-active — illegal
      }),
    } as any);

    const res = await POST(makePostReq({ requestId: 'r1', reason: 'GDPR rollback' }), {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(500);
    expect(mocks.riderUpdate).not.toHaveBeenCalled();
  });

  it('audit log records the restored-to state (the audit trail is self-describing)', async () => {
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'CLOSED',
      purgedAt: null,
    });
    mocks.auditLogFindFirst.mockResolvedValue({
      details: JSON.stringify({
        approvalToken: 'tok',
        previousLifecycleStatus: 'SUSPENDED',
      }),
    } as any);

    const res = await POST(makePostReq({ requestId: 'r1', reason: 'GDPR rollback' }), {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(200);
    // The audit log row for the restore includes
    // `restoredTo` so a follow-up audit can verify
    // the pre-fix fabricated-state bug is gone
    // (i.e. that no restore row has
    // `restoredTo === 'ACTIVE'` for a rider that
    // was previously SUSPENDED).
    const restoreAudit = mocks.auditLogCreate.mock.calls.find(
      (call) => call[0].action === 'rider.data_deletion.restored'
    );
    expect(restoreAudit).toBeDefined();
    expect(restoreAudit![0].details).toHaveProperty('restoredTo', 'SUSPENDED');
  });
});
