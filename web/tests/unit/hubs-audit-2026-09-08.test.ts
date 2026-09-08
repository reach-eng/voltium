/**
 * Hubs audit (2026-09-08) — regression tests for the P0/P1/P2 fixes.
 *
 *   - P1-1: createHubSchema accepts `location: null` / `city: null`
 *           (the UI sends null for empty fields; the old schema 422'd).
 *   - P2-1: updateHubSchema has no isActive default — `{id, name}` must
 *           NOT re-activate a deactivated hub.
 *   - P1-2: /api/admin/hubs/bulk/undo restores deletedAt: null + isActive
 *           in a transaction with one awaited audit entry.
 *   - P2-2: DELETE + bulk routes map HubStateError → 409 via instanceof.
 *   - P1-3: bulkActivate/bulkDeactivate filter deletedAt: null (hub +
 *           team-leader repos).
 *   - P1-4: deleteHub counts only live vehicles (soft-deleted excluded).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createHubSchema, updateHubSchema } from '@/lib/validators';
import { hubRepository } from '@/server/modules/hubs/hub.repository';
import { teamLeaderRepository } from '@/server/modules/team-leaders/team-leader.repository';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const m = vi.hoisted(() => {
  class HubStateError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'HubStateError';
    }
  }
  return {
    requireAdmin: vi.fn(),
    adminUnauthorized: vi.fn(),
    adminForbidden: vi.fn(),
    hasPermission: vi.fn(),
    invalidateCache: vi.fn(),
    invalidateHubCache: vi.fn(),
    createAuditLog: vi.fn(() => Promise.resolve()),
    createHub: vi.fn(),
    updateHub: vi.fn(),
    deleteHub: vi.fn(),
    bulkActivate: vi.fn(),
    bulkDeactivate: vi.fn(),
    bulkDelete: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    HubStateError,
  };
});

vi.mock('@/lib/rbac', () => ({
  requireAdmin: m.requireAdmin,
  adminUnauthorized: m.adminUnauthorized,
  adminForbidden: m.adminForbidden,
}));
vi.mock('@/lib/auth', () => ({ hasPermission: m.hasPermission }));
vi.mock('@/lib/cache', () => ({ getOrSetResponse: vi.fn(), invalidateCache: m.invalidateCache }));
vi.mock('@/lib/server-cache', () => ({ invalidateHubCache: m.invalidateHubCache }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: m.createAuditLog }));
vi.mock('@/server/modules/hubs/hub.use-cases', () => ({
  hubUseCases: {
    createHub: m.createHub,
    updateHub: m.updateHub,
    deleteHub: m.deleteHub,
    bulkActivate: m.bulkActivate,
    bulkDeactivate: m.bulkDeactivate,
    bulkDelete: m.bulkDelete,
  },
  HubStateError: m.HubStateError,
}));

import { DELETE as hubsDELETE, PUT as hubsPUT } from '@/app/api/admin/hubs/route';
import { POST as hubsBulkPOST } from '@/app/api/admin/hubs/bulk/route';
import { POST as hubsUndoPOST } from '@/app/api/admin/hubs/bulk/undo/route';

function makeRequest(url: string, body?: unknown, method = 'POST'): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Schema contracts (P1-1 / P2-1)
// ═══════════════════════════════════════════════════════════════════════════

describe('P1-1: hub schema accepts null location/city (the UI sends null)', () => {
  it('parses { location: null, city: null } on create', () => {
    const r = createHubSchema.safeParse({
      name: 'Downtown Hub',
      location: null,
      city: null,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.location).toBeNull();
      expect(r.data.city).toBeNull();
    }
  });

  it('still accepts empty strings and omitted fields', () => {
    expect(createHubSchema.safeParse({ name: 'X Hub', location: '', city: '' }).success).toBe(
      true
    );
    expect(createHubSchema.safeParse({ name: 'X Hub' }).success).toBe(true);
  });
});

describe('P2-1: updateHubSchema has no isActive default', () => {
  it('parsing { id, name } does NOT inject isActive: true', () => {
    const r = updateHubSchema.safeParse({ id: 'h1', name: 'Renamed' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.isActive).toBeUndefined();
      expect(r.data.name).toBe('Renamed');
    }
  });

  it('still accepts an explicit isActive', () => {
    const r = updateHubSchema.safeParse({ id: 'h1', isActive: false });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isActive).toBe(false);
  });

  it('still accepts null location on update', () => {
    const r = updateHubSchema.safeParse({ id: 'h1', location: null });
    expect(r.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Repository guards (P1-3 / P1-4)
// ═══════════════════════════════════════════════════════════════════════════

describe('P1-3: bulk activate/deactivate never touch soft-deleted rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hub bulkActivate filters deletedAt: null', async () => {
    const { db } = await import('@/lib/db');
    const spy = vi.spyOn(db.hub, 'updateMany').mockResolvedValue({ count: 2 } as any);
    await hubRepository.bulkActivate(['h1', 'h2']);
    expect(spy).toHaveBeenCalledWith({
      where: { id: { in: ['h1', 'h2'] }, deletedAt: null },
      data: { isActive: true },
    });
    spy.mockRestore();
  });

  it('hub bulkDeactivate filters deletedAt: null', async () => {
    const { db } = await import('@/lib/db');
    const spy = vi.spyOn(db.hub, 'updateMany').mockResolvedValue({ count: 2 } as any);
    await hubRepository.bulkDeactivate(['h1', 'h2']);
    expect(spy).toHaveBeenCalledWith({
      where: { id: { in: ['h1', 'h2'] }, deletedAt: null },
      data: { isActive: false },
    });
    spy.mockRestore();
  });

  it('team-leader bulkActivate/bulkDeactivate filter deletedAt: null', async () => {
    const { db } = await import('@/lib/db');
    const spy = vi.spyOn(db.teamLeader, 'updateMany').mockResolvedValue({ count: 1 } as any);
    await teamLeaderRepository.bulkActivate(['t1']);
    expect(spy).toHaveBeenCalledWith({
      where: { id: { in: ['t1'] }, deletedAt: null },
      data: { isActive: true },
    });
    await teamLeaderRepository.bulkDeactivate(['t1']);
    expect(spy).toHaveBeenLastCalledWith({
      where: { id: { in: ['t1'] }, deletedAt: null },
      data: { isActive: false },
    });
    spy.mockRestore();
  });
});

describe('P1-4: deleteHub counts only live vehicles', () => {
  it('getVehicleCount filters deletedAt: null', async () => {
    const { db } = await import('@/lib/db');
    const spy = vi.spyOn(db.vehicle, 'count').mockResolvedValue(3 as any);
    await hubRepository.getVehicleCount('h1');
    expect(spy).toHaveBeenCalledWith({ where: { hubId: 'h1', deletedAt: null } });
    spy.mockRestore();
  });
});

describe('P0-1: hub list search/status apply server-side (all pages)', () => {
  it('findAllPaginated forwards search + status into findMany and count', async () => {
    const { db } = await import('@/lib/db');
    const findMany = vi
      .spyOn(db.hub, 'findMany')
      .mockResolvedValue([{ id: 'h1' }] as any);
    const count = vi.spyOn(db.hub, 'count').mockResolvedValue(1 as any);

    await hubRepository.findAllPaginated(2, 20, 'downtown', 'ACTIVE');

    const expectedWhere = {
      deletedAt: null,
      isActive: true,
      OR: [
        { name: { contains: 'downtown', mode: 'insensitive' } },
        { location: { contains: 'downtown', mode: 'insensitive' } },
        { city: { contains: 'downtown', mode: 'insensitive' } },
      ],
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere, skip: 20, take: 20 })
    );
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
    findMany.mockRestore();
    count.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════════════════════════════════

describe('P2-2: hub routes map HubStateError → 409 via instanceof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'OPERATIONS_ADMIN' });
    m.hasPermission.mockReturnValue(true);
    m.adminUnauthorized.mockReturnValue(new Response(null, { status: 401 }));
    m.adminForbidden.mockReturnValue(
      new Response(JSON.stringify({ success: false }), { status: 403 })
    );
  });

  it('DELETE maps HubStateError → 409', async () => {
    m.deleteHub.mockRejectedValue(
      new m.HubStateError(
        'Cannot delete hub: 3 vehicle(s) still assigned. Reassign them first.'
      )
    );
    const res = await hubsDELETE(makeRequest('/api/admin/hubs', { id: 'h1' }, 'DELETE'));
    expect(res.status).toBe(409);
  });

  it('bulk route maps HubStateError → 409', async () => {
    m.bulkDelete.mockRejectedValue(new m.HubStateError('Cannot delete 1 hub(s) with vehicles'));
    const res = await hubsBulkPOST(
      makeRequest('/api/admin/hubs/bulk', { ids: ['h1'], action: 'delete' })
    );
    expect(res.status).toBe(409);
  });

  it('PUT rejects a non-boolean isActive with 422 (schema), not 409', async () => {
    const res = await hubsPUT(
      makeRequest('/api/admin/hubs', { id: 'h1', isActive: 'yes' }, 'PUT')
    );
    expect(res.status).toBe(422);
    expect(m.updateHub).not.toHaveBeenCalled();
  });
});

describe('P1-2: /api/admin/hubs/bulk/undo restores soft-deleted hubs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'OPERATIONS_ADMIN' });
    m.hasPermission.mockReturnValue(true);
    m.adminUnauthorized.mockReturnValue(new Response(null, { status: 401 }));
    m.adminForbidden.mockReturnValue(
      new Response(JSON.stringify({ success: false }), { status: 403 })
    );
  });

  it('restores isActive + deletedAt: null inside a transaction with one audit entry', async () => {
    const { db } = await import('@/lib/db');
    const txUpdates: unknown[] = [];
    const tx = {
      hub: {
        update: vi.fn().mockImplementation(async (args: unknown) => {
          txUpdates.push(args);
          return {};
        }),
      },
    };
    const txSpy = vi.spyOn(db, '$transaction').mockImplementation(
      async (fn: any) => fn(tx)
    );

    const res = await hubsUndoPOST(
      makeRequest('/api/admin/hubs/bulk/undo', {
        items: [
          { id: 'h1', isActive: true },
          { id: 'h2', isActive: false },
        ],
      })
    );
    expect(res.status).toBe(200);
    expect(txUpdates).toEqual([
      { where: { id: 'h1' }, data: { isActive: true, deletedAt: null } },
      { where: { id: 'h2' }, data: { isActive: false, deletedAt: null } },
    ]);
    expect(m.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'hub.bulk_undo',
        entityId: 'multiple',
        details: { count: 2, items: ['h1', 'h2'] },
      })
    );
    expect(m.invalidateCache).toHaveBeenCalledWith('admin:hubs:*');
    txSpy.mockRestore();
  });

  it('422s items missing isActive', async () => {
    const res = await hubsUndoPOST(
      makeRequest('/api/admin/hubs/bulk/undo', { items: [{ id: 'h1' }] })
    );
    expect(res.status).toBe(422);
  });
});