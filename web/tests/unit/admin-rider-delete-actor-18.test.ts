/**
 * NET-005 follow-up-18 (2026-09-08): three sub-fixes
 *
 * 1. Single DELETE /api/admin/riders calls
 *    `adminRiderUseCases.delete(id, actorId)` — the
 *    previous code passed NO actor, so the use-case's
 *    in-transaction audit row defaulted to
 *    `actorId: 'system' / actorType: 'SYSTEM'`, while
 *    the route then wrote a SECOND audit row with the
 *    real admin. Two rows, and the authoritative
 *    in-transaction one said the system did it.
 * 2. Bulk DELETE /api/admin/riders/bulk calls
 *    `adminRiderUseCases.delete(id, actorId)` for
 *    each id — the previous code passed NO actor and
 *    the bulk route did NOT write a second route-level
 *    audit row, so bulk deletes left only the
 *    SYSTEM row.
 * 3. GDPR two-person flow is no longer
 *    de-facto superadmin-only: the executor's
 *    undeclared `admin:write` key is replaced with
 *    `riders_delete_execute` (declared + granted to
 *    SUPER_ADMIN and FINANCE_ADMIN);
 *    `riders_delete_approve` is granted to
 *    OPERATIONS_ADMIN + FINANCE_ADMIN; and
 *    `riders_delete_recover` is granted to
 *    OPERATIONS_ADMIN + FINANCE_ADMIN. The existing
 *    two-person rule (data-deletion/route.ts:83-85)
 *    still blocks the same admin from both
 *    requesting and approving.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { ROLE_PERMISSIONS } from '@/lib/permissions-roles';

// ---------------------------------------------------------------------------
// Shared mock infra
// ---------------------------------------------------------------------------

const sharedMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  // BOTH the single DELETE and the bulk DELETE call
  // `adminRiderUseCases.delete` — the same use-case
  // method. One mock fn for both routes.
  useCaseDelete: vi.fn(),
  bulkUpdate: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: sharedMocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));

vi.mock('@/lib/auth', () => ({ hasPermission: sharedMocks.hasPermission }));

// The single DELETE route uses `getAdminSession` (the bulk route uses
// `requireAdmin` from `@/lib/rbac` which is already mocked above).
// Both routes share `sharedMocks.requireAdmin` as the resolved value.
vi.mock('@/lib/get-session', () => ({
  getAdminSession: sharedMocks.requireAdmin,
}));

vi.mock('@/lib/server-cache', () => ({ invalidateRiderCache: vi.fn() }));
vi.mock('@/lib/cache', () => ({
  getOrSetResponse: vi.fn(),
  invalidateCache: vi.fn(),
  withCacheHeaders: (r: Response) => r,
}));
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/modules/riders/admin-riders.use-cases', () => ({
  adminRiderUseCases: {
    delete: sharedMocks.useCaseDelete,
    update: sharedMocks.bulkUpdate,
  },
}));

// `withIdempotency` would normally key on `x-idempotency-key` and
// store responses in Redis. For this unit test, just call the inner
// handler directly so the test exercises the bulk delete branch only.
vi.mock('@/lib/api-middleware', () => ({
  withIdempotency:
    (handler: (req: NextRequest) => Promise<Response>) =>
    (req: NextRequest): Promise<Response> =>
      handler(req),
}));

import { DELETE as singleDeleteRoute } from '@/app/api/admin/riders/route';
import { POST as bulkPostRoute } from '@/app/api/admin/riders/bulk/route';

// ---------------------------------------------------------------------------
// 18a-1: Single DELETE passes the actor and writes no duplicate audit row.
// ---------------------------------------------------------------------------

describe('NET-005 follow-up-18: single DELETE /api/admin/riders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedMocks.requireAdmin.mockResolvedValue({
      adminId: 'admin-7',
      riderDbId: 'rider_db_admin-7',
      adminRole: 'OPERATIONS_ADMIN',
    });
    sharedMocks.hasPermission.mockReturnValue(true);
    sharedMocks.useCaseDelete.mockResolvedValue(undefined);
  });

  it('passes session.adminId as the second argument to the use-case', async () => {
    const req = new NextRequest('http://localhost/api/admin/riders?id=rider-1', {
      method: 'DELETE',
    });
    const res = await singleDeleteRoute(req);

    expect(res.status).toBe(200);
    expect(sharedMocks.useCaseDelete).toHaveBeenCalledTimes(1);
    expect(sharedMocks.useCaseDelete).toHaveBeenCalledWith('rider-1', 'admin-7');
  });

  it('falls back to session.riderDbId when adminId is missing', async () => {
    sharedMocks.requireAdmin.mockResolvedValue({
      // No adminId; fallback to riderDbId.
      adminId: null,
      riderDbId: 'rider_db_admin-7',
      adminRole: 'OPERATIONS_ADMIN',
    });
    const req = new NextRequest('http://localhost/api/admin/riders?id=rider-1', {
      method: 'DELETE',
    });
    await singleDeleteRoute(req);
    expect(sharedMocks.useCaseDelete).toHaveBeenCalledWith('rider-1', 'rider_db_admin-7');
  });

  it('returns 401 when neither adminId nor riderDbId is present', async () => {
    sharedMocks.requireAdmin.mockResolvedValue({
      adminId: null,
      riderDbId: null,
      adminRole: 'OPERATIONS_ADMIN',
    });
    const req = new NextRequest('http://localhost/api/admin/riders?id=rider-1', {
      method: 'DELETE',
    });
    const res = await singleDeleteRoute(req);
    // The route short-circuits with `errors.unauthorized('Admin session
    // has no actor id')` BEFORE calling the use-case. The previous code
    // would have called delete(id) and the use-case's silent-SYSTEM
    // fallback would have written the wrong audit row.
    expect(res.status).toBe(401);
    expect(sharedMocks.useCaseDelete).not.toHaveBeenCalled();
  });

  it('returns 403 when admin lacks riders_delete permission', async () => {
    sharedMocks.hasPermission.mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/admin/riders?id=rider-1', {
      method: 'DELETE',
    });
    const res = await singleDeleteRoute(req);
    expect(res.status).toBe(403);
    expect(sharedMocks.useCaseDelete).not.toHaveBeenCalled();
  });

  it('does NOT call createAuditLog at the route level (use-case owns the audit row)', async () => {
    // Regression lock for the duplicate-audit-row bug. The previous code
    // wrote TWO rows: one inside the use-case transaction (as SYSTEM)
    // and one at the route level (as the real admin). The use-case
    // now writes a single in-transaction row with the real actor; the
    // route MUST NOT write a second one.
    const { createAuditLog } = await import('@/lib/audit-log');
    const req = new NextRequest('http://localhost/api/admin/riders?id=rider-1', {
      method: 'DELETE',
    });
    await singleDeleteRoute(req);
    expect(vi.mocked(createAuditLog)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 18a-2: Bulk DELETE passes the actor for every id.
// ---------------------------------------------------------------------------

describe('NET-005 follow-up-18: bulk DELETE /api/admin/riders/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedMocks.requireAdmin.mockResolvedValue({
      adminId: 'admin-bulk-1',
      riderDbId: 'rider_db_bulk-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    sharedMocks.hasPermission.mockReturnValue(true);
    sharedMocks.useCaseDelete.mockResolvedValue(undefined);
  });

  const makePostReq = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost/api/admin/riders/bulk', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

  it('passes session.adminId as the second argument for every id', async () => {
    const req = makePostReq({
      ids: ['rider-1', 'rider-2', 'rider-3'],
      action: 'delete',
    });
    const res = await bulkPostRoute(req);
    expect(res.status).toBe(200);
    expect(sharedMocks.useCaseDelete).toHaveBeenCalledTimes(3);
    expect(sharedMocks.useCaseDelete).toHaveBeenNthCalledWith(1, 'rider-1', 'admin-bulk-1');
    expect(sharedMocks.useCaseDelete).toHaveBeenNthCalledWith(2, 'rider-2', 'admin-bulk-1');
    expect(sharedMocks.useCaseDelete).toHaveBeenNthCalledWith(3, 'rider-3', 'admin-bulk-1');
  });

  it('records per-id failures WITHOUT dropping the actor (failures list does not corrupt the actor)', async () => {
    // Mixed: first call succeeds, second throws "Refusing to delete
    // rider with financial records".
    sharedMocks.useCaseDelete
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => {
        throw new Error(
          'Refusing to delete rider with financial records (wallet/transaction/ledger/deposit). Use lifecycle CLOSE + GDPR purge job instead.'
        );
      });
    const req = makePostReq({ ids: ['rider-good', 'rider-rich'], action: 'delete' });
    const res = await bulkPostRoute(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.count).toBe(1);
    expect(json.data.failures).toEqual([
      {
        id: 'rider-rich',
        error: expect.stringContaining('Refusing to delete'),
      },
    ]);
    // The successful call still got the actor.
    expect(sharedMocks.useCaseDelete).toHaveBeenNthCalledWith(1, 'rider-good', 'admin-bulk-1');
    expect(sharedMocks.useCaseDelete).toHaveBeenNthCalledWith(2, 'rider-rich', 'admin-bulk-1');
  });
});

// ---------------------------------------------------------------------------
// 18b: GDPR two-person flow permission grants.
// ---------------------------------------------------------------------------

describe('NET-005 follow-up-18: GDPR two-person permission grants', () => {
  it('riders_delete_execute is granted to SUPER_ADMIN', () => {
    // The new executor key — replaces the undeclared `admin:write` key
    // the executor route used before. The blanket SUPER_ADMIN bypass
    // at permissions.ts:75 still gives SUPER_ADMIN access; this
    // explicit grant is documentation + a startup-time lock.
    expect(ROLE_PERMISSIONS['riders_delete_execute']).toContain('SUPER_ADMIN');
  });

  it('riders_delete_execute is granted to FINANCE_ADMIN', () => {
    expect(ROLE_PERMISSIONS['riders_delete_execute']).toContain('FINANCE_ADMIN');
  });

  it('riders_delete_approve is granted to OPERATIONS_ADMIN + FINANCE_ADMIN', () => {
    // The two-person rule at data-deletion/route.ts:83-85 still
    // blocks the same admin from requesting AND approving. Granting
    // both roles here just means the approve can come from either
    // role — a different admin from the requester.
    expect(ROLE_PERMISSIONS['riders_delete_approve']).toContain('OPERATIONS_ADMIN');
    expect(ROLE_PERMISSIONS['riders_delete_approve']).toContain('FINANCE_ADMIN');
  });

  it('riders_delete_recover is granted to OPERATIONS_ADMIN + FINANCE_ADMIN', () => {
    expect(ROLE_PERMISSIONS['riders_delete_recover']).toContain('OPERATIONS_ADMIN');
    expect(ROLE_PERMISSIONS['riders_delete_recover']).toContain('FINANCE_ADMIN');
  });

  it('riders_delete_execute does NOT grant to OPERATIONS_ADMIN (separation of duties)', async () => {
    // The executor is the second-person step. Granting OPERATIONS_ADMIN
    // here would let a single OPERATIONS_ADMIN request + execute their
    // own deletion, defeating the two-person rule. (The two-person
    // check still catches requester==executor, but the separation
    // makes the intent explicit at the role level.)
    expect(ROLE_PERMISSIONS['riders_delete_execute']).not.toContain('OPERATIONS_ADMIN');
  });

  it('hasPermission("FINANCE_ADMIN", "riders_delete_execute") returns true', () => {
    expect(hasPermission('FINANCE_ADMIN', 'riders_delete_execute')).toBe(true);
  });

  it('hasPermission("FINANCE_ADMIN", "riders_delete_approve") returns true', () => {
    expect(hasPermission('FINANCE_ADMIN', 'riders_delete_approve')).toBe(true);
  });

  it('hasPermission("OPERATIONS_ADMIN", "riders_delete_approve") returns true', () => {
    expect(hasPermission('OPERATIONS_ADMIN', 'riders_delete_approve')).toBe(true);
  });

  it('hasPermission("SUPER_ADMIN", "riders_delete_approve") returns true via the blanket bypass', () => {
    // The pre-existing SUPER_ADMIN bypass at permissions.ts:75 still
    // works; this test just pins the behavior so a future refactor
    // that removes the bypass (e.g. for audit_view) is caught here
    // for the GDPR keys.
    expect(hasPermission('SUPER_ADMIN', 'riders_delete_approve')).toBe(true);
  });

  it('hasPermission("SUPPORT_AGENT", "riders_delete_execute") returns false (the pre-fix bug)', () => {
    // Pre-fix: the executor route used the undeclared `admin:write`
    // key, which was NOT in the role map. hasPermission fell through
    // to the SUPER_ADMIN bypass — only SUPER_ADMIN got through. Now
    // that the key is declared and granted, non-granted roles get a
    // clean false. SUPPORT_AGENT was never intended to execute GDPR
    // deletions.
    expect(hasPermission('SUPPORT_AGENT', 'riders_delete_execute')).toBe(false);
  });
});
