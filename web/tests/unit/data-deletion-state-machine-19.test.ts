/**
 * NET-005 follow-up-19 (2026-09-08): state-machine
 * validation in the GDPR data-deletion execute and
 * restore routes.
 *
 * The pre-fix code wrote `lifecycleStatus: 'CLOSED'`
 * (execute) and `lifecycleStatus: 'ACTIVE'` (restore)
 * directly with no state-machine check. The
 * `rider-lifecycle.service.ts` state machine was
 * bypassed. After the fix, the routes call
 * `validateTransition` and throw `RiderLifecycleError`
 * on illegal source/target combinations.
 *
 * (The admin update() state-machine validation is
 * covered in `admin-rider-state-machine-validation-19.test.ts`
 * — split into a separate file because it has a
 * different mock footprint.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  riderFindUnique: vi.fn(),
  auditLogFindFirst: vi.fn(),
  auditLogCreate: vi.fn(),
  riderUpdate: vi.fn(),
  transaction: vi.fn(),
  requirePermission: vi.fn(),
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
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/rbac', () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/lib/audit-log', () => ({
  // The route's failure-path audit log uses
  // `createAuditLog({...}).catch(() => {})` —
  // must return a thenable so the .catch call
  // doesn't throw.
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { DELETE as dataDeletionDelete } from '@/app/api/admin/riders/[id]/data-deletion/route';
import { POST as dataDeletionRestore } from '@/app/api/admin/riders/[id]/data-deletion/restore/route';
import { RiderLifecycleError } from '@/server/modules/riders/rider-lifecycle.service';

describe('NET-005 follow-up-19: data-deletion execute validates CLOSED source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({
      adminId: 'admin-1',
    });
    mocks.auditLogFindFirst.mockResolvedValue({
      details: JSON.stringify({ approvalToken: 'tok', requestedBy: 'admin-2' }),
    });
    mocks.transaction.mockImplementation(async (cb) => {
      const tx = {
        rider: { update: mocks.riderUpdate },
        deviceViolation: { deleteMany: vi.fn() },
        userCallLog: { deleteMany: vi.fn() },
        userContact: { deleteMany: vi.fn() },
        userLocation: { deleteMany: vi.fn() },
      };
      return cb(tx);
    });
  });

  it('rejects soft-delete from NEW (state machine forbids NEW → CLOSED)', async () => {
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'NEW',
      leases: [],
    });

    const req = new NextRequest(
      'http://localhost/api/admin/riders/r1/data-deletion',
      { method: 'DELETE', body: JSON.stringify({ approvalToken: 'tok' }) }
    );
    const res = await dataDeletionDelete(req, {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(409);
    // The transaction never ran (validation short-circuits before).
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects soft-delete from PROFILE_SUBMITTED (state machine forbids PROFILE_SUBMITTED → CLOSED)', async () => {
    // Pre-active riders should not be soft-deleted via
    // the GDPR path — their PII is cleared by the
    // purge job, not the soft-delete path. This test
    // pins the new boundary.
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'PROFILE_SUBMITTED',
      leases: [],
    });

    const req = new NextRequest(
      'http://localhost/api/admin/riders/r1/data-deletion',
      { method: 'DELETE', body: JSON.stringify({ approvalToken: 'tok' }) }
    );
    const res = await dataDeletionDelete(req, {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(409);
  });

  it('allows soft-delete from ACTIVE (ACTIVE → CLOSED is in the machine)', async () => {
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'ACTIVE',
      leases: [],
    });
    mocks.riderUpdate.mockResolvedValue({});
    mocks.auditLogCreate.mockResolvedValue(undefined);

    const req = new NextRequest(
      'http://localhost/api/admin/riders/r1/data-deletion',
      { method: 'DELETE', body: JSON.stringify({ approvalToken: 'tok' }) }
    );
    const res = await dataDeletionDelete(req, {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(200);
  });

  it('allows soft-delete from SUSPENDED (SUSPENDED → CLOSED is in the machine)', async () => {
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'SUSPENDED',
      leases: [],
    });
    mocks.riderUpdate.mockResolvedValue({});
    mocks.auditLogCreate.mockResolvedValue(undefined);

    const req = new NextRequest(
      'http://localhost/api/admin/riders/r1/data-deletion',
      { method: 'DELETE', body: JSON.stringify({ approvalToken: 'tok' }) }
    );
    const res = await dataDeletionDelete(req, {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('NET-005 follow-up-19: data-deletion restore validates CLOSED source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({
      adminId: 'admin-1',
    });
    // NET-005 follow-up-22 (2026-09-08): the
    // restore route now reads the
    // `rider.data_deletion.initiated` audit log
    // to recover the pre-deletion state.
    // Mock it for the happy-path tests. The
    // failure-path tests override as needed.
    mocks.auditLogFindFirst.mockResolvedValue({
      details: JSON.stringify({
        approvalToken: 'tok',
        previousLifecycleStatus: 'ACTIVE',
      }),
    });
  });

  it('rejects restore from NEW (route short-circuits with 400 "not in soft-deleted state")', async () => {
    // The route checks `lifecycleStatus !== 'CLOSED'`
    // before the state-machine call, so a non-CLOSED
    // rider returns 400 (not 409). The state-machine
    // call is defense-in-depth for the case where a
    // future schema migration leaves a rider in an
    // unexpected state.
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'NEW',
      purgedAt: null,
    });

    const req = new NextRequest(
      'http://localhost/api/admin/riders/r1/data-deletion/restore',
      {
        method: 'POST',
        body: JSON.stringify({ requestId: 'r1', reason: 'GDPR rollback' }),
      }
    );
    const res = await dataDeletionRestore(req, {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(400);
    expect(mocks.riderUpdate).not.toHaveBeenCalled();
  });

  it('rejects restore from PICKUP_SCHEDULED (same 400 short-circuit)', async () => {
    // The route checks `lifecycleStatus !== 'CLOSED'`
    // before the state-machine call.
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'PICKUP_SCHEDULED',
      purgedAt: null,
    });

    const req = new NextRequest(
      'http://localhost/api/admin/riders/r1/data-deletion/restore',
      {
        method: 'POST',
        body: JSON.stringify({ requestId: 'r1', reason: 'GDPR rollback' }),
      }
    );
    const res = await dataDeletionRestore(req, {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects restore from ACTIVE (same 400 short-circuit)', async () => {
    // The state-machine check is a defense-in-depth
    // for the case where a future schema migration
    // leaves a rider in a non-CLOSED state. The
    // "not in soft-deleted state" 400 check fires
    // first and is the user-facing response.
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'ACTIVE',
      purgedAt: null,
    });

    const req = new NextRequest(
      'http://localhost/api/admin/riders/r1/data-deletion/restore',
      {
        method: 'POST',
        body: JSON.stringify({ requestId: 'r1', reason: 'GDPR rollback' }),
      }
    );
    const res = await dataDeletionRestore(req, {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(400);
  });

  it('allows restore from CLOSED (CLOSED → ACTIVE is the new transition added in follow-up-19)', async () => {
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'CLOSED',
      purgedAt: null,
    });
    mocks.riderUpdate.mockResolvedValue({});
    mocks.auditLogCreate.mockResolvedValue(undefined);

    const req = new NextRequest(
      'http://localhost/api/admin/riders/r1/data-deletion/restore',
      {
        method: 'POST',
        body: JSON.stringify({ requestId: 'r1', reason: 'GDPR rollback' }),
      }
    );
    const res = await dataDeletionRestore(req, {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(200);
  });

  it('rejects restore with no body (the schema requires a reason)', async () => {
    // The schema requires `reason: z.string().min(1)`.
    // No body → 422 from the route's validation gate,
    // which runs before the state-machine check. This
    // is a regression lock for the schema, not the
    // state machine, but it's worth pinning since
    // the route is the only data-deletion consumer.
    mocks.riderFindUnique.mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'CLOSED',
      purgedAt: null,
    });

    const req = new NextRequest(
      'http://localhost/api/admin/riders/r1/data-deletion/restore',
      { method: 'POST', body: JSON.stringify({}) }
    );
    const res = await dataDeletionRestore(req, {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(422);
    expect(mocks.riderUpdate).not.toHaveBeenCalled();
  });
});

// Sanity check: the new state machine transition
// CLOSED → ACTIVE is the legitimate legal path for
// the restore route. The other states are not.
describe('NET-005 follow-up-19: state machine CLOSED transition is in the map', () => {
  it('CLOSED → ACTIVE is allowed (GDPR restore path)', async () => {
    const { validateTransition } = await import(
      '@/server/modules/riders/rider-lifecycle.service'
    );
    expect(() => validateTransition('CLOSED', 'ACTIVE')).not.toThrow();
  });

  it('CLOSED → {ACTIVE, SUSPENDED, RETURN_PENDING} all allowed; pre-active states still rejected', async () => {
    // NET-005 follow-up-22 (2026-09-08): the
    // three legal restore target states are
    // ACTIVE, SUSPENDED, RETURN_PENDING. The
    // pre-fix only allowed ACTIVE.
    const { validateTransition } = await import(
      '@/server/modules/riders/rider-lifecycle.service'
    );
    expect(() => validateTransition('CLOSED', 'ACTIVE')).not.toThrow();
    expect(() => validateTransition('CLOSED', 'SUSPENDED')).not.toThrow();
    expect(() => validateTransition('CLOSED', 'RETURN_PENDING')).not.toThrow();
    // Pre-active states are still rejected.
    expect(() => validateTransition('CLOSED', 'NEW')).toThrow(RiderLifecycleError);
    expect(() => validateTransition('CLOSED', 'PICKUP_SCHEDULED')).toThrow(
      RiderLifecycleError
    );
    expect(() => validateTransition('CLOSED', 'KYC_SUBMITTED')).toThrow(
      RiderLifecycleError
    );
  });
});
