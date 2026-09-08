import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  getCachedRider: vi.fn((id, fn) => fn()),
  invalidateRiderCache: vi.fn(),
  invalidateCache: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  useCaseSuspend: vi.fn(),
  useCaseUpdate: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    $transaction: vi.fn(async (fn) =>
      fn({
        rider: {
          update: mocks.update,
          findUnique: mocks.findUnique,
        },
      })
    ),
  },
}));

vi.mock('@/lib/server-cache', () => ({
  getCachedRider: mocks.getCachedRider,
  invalidateRiderCache: mocks.invalidateRiderCache,
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: mocks.invalidateCache,
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: mocks.hasPermission,
}));

vi.mock('@/lib/api-middleware', () => ({
  withIdempotency: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(req),
}));

import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';
import { POST as bulkPostRoute } from '@/app/api/admin/riders/bulk/route';

describe('P0-1: adminRiderUseCases.suspend unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suspend NEW -> SUSPENDED succeeds + bypasses machine + audit row exists', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'rider-new',
      lifecycleStatus: 'NEW',
    });
    mocks.update.mockResolvedValue({
      id: 'rider-new',
      lifecycleStatus: 'SUSPENDED',
    });

    const result = await adminRiderUseCases.suspend('rider-new', {
      actorId: 'admin-1',
      actorRole: 'OPERATIONS_ADMIN',
      reason: 'Rule violation',
    });

    expect(result).toMatchObject({ lifecycleStatus: 'SUSPENDED' });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'rider-new' },
      data: { lifecycleStatus: 'SUSPENDED' },
    });
    expect(mocks.invalidateRiderCache).toHaveBeenCalledWith('rider-new');
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:*');
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rider.suspend',
        entity: 'rider',
        entityId: 'rider-new',
        actorId: 'admin-1',
        details: expect.objectContaining({
          previousStatus: 'NEW',
          reason: 'Rule violation',
        }),
      })
    );
  });

  it('suspend already-SUSPENDED is idempotent success', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'rider-already-suspended',
      lifecycleStatus: 'SUSPENDED',
    });
    mocks.update.mockResolvedValue({
      id: 'rider-already-suspended',
      lifecycleStatus: 'SUSPENDED',
    });

    const result = await adminRiderUseCases.suspend('rider-already-suspended', {
      actorId: 'admin-2',
      actorRole: 'OPERATIONS_ADMIN',
    });

    expect(result).toMatchObject({ lifecycleStatus: 'SUSPENDED' });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rider.suspend',
        entityId: 'rider-already-suspended',
        details: expect.objectContaining({
          previousStatus: 'SUSPENDED',
        }),
      })
    );
  });

  it('throws "Rider not found" when rider does not exist', async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(
      adminRiderUseCases.suspend('non-existent', {
        actorId: 'admin-1',
      })
    ).rejects.toThrow('Rider not found');
  });
});

describe('P0-1 & P1-6: POST /api/admin/riders/bulk route tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin-ops',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);
  });

  const makePostReq = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost/api/admin/riders/bulk', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

  it('action: "suspend" calls suspend on each id and invalidates admin cache', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'r1', lifecycleStatus: 'ACTIVE' });
    mocks.update.mockResolvedValue({ id: 'r1', lifecycleStatus: 'SUSPENDED' });

    const req = makePostReq({
      ids: ['r1', 'r2'],
      action: 'suspend',
      value: 'Late payment',
    });

    const res = await bulkPostRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(2);
    expect(body.data.failures).toHaveLength(0);
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:*');
  });

  it('action: "updateStatus" with value "SUSPENDED" routes to suspend (legacy compatibility)', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'r1', lifecycleStatus: 'NEW' });
    mocks.update.mockResolvedValue({ id: 'r1', lifecycleStatus: 'SUSPENDED' });

    const req = makePostReq({
      ids: ['r1'],
      action: 'updateStatus',
      value: 'SUSPENDED',
    });

    const res = await bulkPostRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(1);
    expect(body.data.failures).toHaveLength(0);

    // Verifies it wrote rider.suspend audit row (state machine bypassed)
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rider.suspend',
        entityId: 'r1',
        details: expect.objectContaining({ previousStatus: 'NEW' }),
      })
    );
  });

  it('action: "updateStatus" + bogus value -> per-id failure entry, not throw', async () => {
    // Rider in NEW state: transition to BOGUS_STATUS is illegal in validateTransition
    mocks.findUnique.mockResolvedValue({ id: 'r1', lifecycleStatus: 'NEW' });

    const req = makePostReq({
      ids: ['r1'],
      action: 'updateStatus',
      value: 'BOGUS_STATUS',
    });

    const res = await bulkPostRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(0);
    expect(body.data.failures).toHaveLength(1);
    expect(body.data.failures[0].id).toBe('r1');
    expect(body.data.failures[0].error).toContain('Invalid rider lifecycle transition');
  });

  it('non-OPS/FLEET role without riders_update -> 403 Forbidden', async () => {
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'tl-1',
      adminRole: 'TEAM_LEADER',
    });
    mocks.hasPermission.mockReturnValue(false);

    const req = makePostReq({
      ids: ['r1'],
      action: 'suspend',
    });

    const res = await bulkPostRoute(req);
    expect(res.status).toBe(403);
  });

  it('unauthenticated caller without session -> 401 Unauthorized', async () => {
    mocks.requireAdmin.mockResolvedValue(null);

    const req = makePostReq({
      ids: ['r1'],
      action: 'suspend',
    });

    const res = await bulkPostRoute(req);
    expect(res.status).toBe(401);
  });

  it('validates schema: empty ids or invalid action returns 400 Bad Request', async () => {
    const reqEmpty = makePostReq({
      ids: [],
      action: 'suspend',
    });
    const resEmpty = await bulkPostRoute(reqEmpty);
    expect(resEmpty.status).toBe(400);

    const reqInvalidAction = makePostReq({
      ids: ['r1'],
      action: 'invalidActionXYZ',
    });
    const resInvalid = await bulkPostRoute(reqInvalidAction);
    expect(resInvalid.status).toBe(400);
  });
});
