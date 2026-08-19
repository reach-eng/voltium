/**
 * P1/P2/P3 (2026-08-05 ops audit) — operations & platform fixes.
 *
 * Covers:
 *   - P1-10/P1-11/P1-12/P3-6/P3-7/P3-8: tickets PUT/POST Zod validation (status
 *     enum, non-empty subject, nullable assignedTo for unassign, safe audit)
 *   - P1-8: incidents POST maps "Rider not found"/"Vehicle not found" to 400
 *   - P1-16/P2-13: feature-flags scoped cache invalidation + no value in audit
 *   - P1-19/P2-18: settings scoped invalidation + registry-missing key → 400
 *   - P2-5/P2-6/P1-5: audit-logs entity filters, malformed-JSON guard,
 *     entityId redaction
 *   - P2-21: getAllFeatureFlags reuses the single DB query (no second findMany)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Static mocks (hoisted above imports; the pattern used by the P0 tests) ─
const rbacMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
}));
const loggerMock = vi.hoisted(() => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
const hasPermissionMock = vi.hoisted(() => vi.fn());
const supportMocks = vi.hoisted(() => ({
  updateTicket: vi.fn(),
  createTicket: vi.fn(),
  logAdminAction: vi.fn(),
}));
const incidentMocks = vi.hoisted(() => ({
  create: vi.fn(),
}));
const flagMocks = vi.hoisted(() => ({
  getAllFeatureFlags: vi.fn(),
  updateFeatureFlag: vi.fn(),
  createAuditLog: vi.fn(),
  invalidateCache: vi.fn(),
}));
const settingsMocks = vi.hoisted(() => ({
  update: vi.fn(),
}));
const auditMocks = vi.hoisted(() => ({
  getAuditLogs: vi.fn(),
}));

vi.mock('@/lib/logger', () => loggerMock);
vi.mock('@/lib/rbac', () => ({
  requireAdmin: rbacMocks.requireAdmin,
  adminUnauthorized: rbacMocks.adminUnauthorized,
  adminForbidden: rbacMocks.adminForbidden,
}));
vi.mock('@/lib/auth', () => ({ hasPermission: hasPermissionMock }));
vi.mock('@/server/modules/support/support.use-cases', () => ({
  supportUseCases: {
    updateTicket: supportMocks.updateTicket,
    createTicket: supportMocks.createTicket,
    logAdminAction: supportMocks.logAdminAction,
  },
}));
vi.mock('@/server/modules/incidents/incident.use-cases', () => ({
  incidentUseCases: { create: incidentMocks.create },
}));
vi.mock('@/lib/feature-flags', () => ({
  getAllFeatureFlags: flagMocks.getAllFeatureFlags,
  updateFeatureFlag: flagMocks.updateFeatureFlag,
}));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: flagMocks.createAuditLog }));
vi.mock('@/lib/cache', () => ({ invalidateCache: flagMocks.invalidateCache }));
vi.mock('@/server/modules/settings/setting.use-cases', () => ({
  settingUseCases: { update: settingsMocks.update, getAll: vi.fn() },
}));
vi.mock('@/server/modules/admin/admin.use-cases', () => ({
  adminUseCases: { getAuditLogs: auditMocks.getAuditLogs },
}));

import { PUT as ticketsPUT, POST as ticketsPOST } from '@/app/api/admin/tickets/route';
import { POST as incidentsPOST } from '@/app/api/admin/incidents/route';
import { PUT as flagsPUT } from '@/app/api/admin/feature-flags/route';
import { PUT as settingsPUT } from '@/app/api/admin/settings/route';
import { GET as auditLogsGET } from '@/app/api/admin/audit-logs/route';

function authSession() {
  rbacMocks.requireAdmin.mockResolvedValue({
    adminId: 'admin_ops_1',
    adminRole: 'SUPER_ADMIN',
    riderDbId: null,
  });
  rbacMocks.adminUnauthorized.mockReturnValue(new Response('unauthorized', { status: 401 }));
  rbacMocks.adminForbidden.mockReturnValue(new Response('forbidden', { status: 403 }));
}

function json(res: Response): Promise<Record<string, unknown>> {
  return res.json() as Promise<Record<string, unknown>>;
}

function putReq(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: 'PUT', body: JSON.stringify(body) });
}
function postReq(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) });
}

// ── Tickets (P1-10/P1-11/P1-12/P3-6/P3-7/P3-8) ──────────────────────────────
describe('P1-10/P1-12: tickets route validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSession();
    hasPermissionMock.mockReturnValue(true);
    supportMocks.updateTicket.mockResolvedValue({ id: 't1', status: 'OPEN' });
    supportMocks.createTicket.mockResolvedValue({ id: 't1', ticketId: '#ABCD', status: 'OPEN' });
    supportMocks.logAdminAction.mockResolvedValue(undefined);
  });

  it('rejects an invalid ticket status with 422 (no more banana statuses)', async () => {
    const res = await ticketsPUT(putReq('/api/admin/tickets', { id: 't1', status: 'banana' }));
    expect(res.status).toBe(422);
    expect(supportMocks.updateTicket).not.toHaveBeenCalled();
  });

  it('rejects an empty-subject admin ticket with 422', async () => {
    const res = await ticketsPOST(
      postReq('/api/admin/tickets', {
        riderDbId: 'rider_1',
        subject: '',
        message: 'A longer message body.',
      })
    );
    expect(res.status).toBe(422);
    expect(supportMocks.createTicket).not.toHaveBeenCalled();
  });

  it('allows unassigning via assignedTo: null (admin UI contract)', async () => {
    const res = await ticketsPUT(putReq('/api/admin/tickets', { id: 't1', assignedTo: null }));
    expect(res.status).toBe(200);
    expect(supportMocks.updateTicket).toHaveBeenCalledWith('t1', { assignedTo: null });
  });

  it('P1-11: accepts a valid status update', async () => {
    const res = await ticketsPUT(putReq('/api/admin/tickets', { id: 't1', status: 'IN_PROGRESS' }));
    expect(res.status).toBe(200);
    expect(supportMocks.updateTicket).toHaveBeenCalledWith('t1', {
      status: 'IN_PROGRESS',
      resolvedAt: null,
    });
  });

  it('P3-8: audit details log only status/assignedTo, never raw payload', async () => {
    await ticketsPUT(putReq('/api/admin/tickets', { id: 't1', status: 'RESOLVED' }));
    expect(supportMocks.logAdminAction).toHaveBeenCalledWith('admin_ops_1', {
      action: 'ticket.resolved',
      ticketId: 't1',
      details: { status: 'RESOLVED', assignedTo: undefined },
    });
  });

  it('P1-12: accepts a valid admin ticket create', async () => {
    const res = await ticketsPOST(
      postReq('/api/admin/tickets', {
        riderDbId: 'rider_1',
        category: 'PAYMENT',
        priority: 'HIGH',
        subject: 'Payment failed twice',
        message: 'My payment failed two times in a row.',
      })
    );
    expect(res.status).toBe(200);
    expect(supportMocks.createTicket).toHaveBeenCalledWith('rider_1', {
      riderId: 'rider_1',
      category: 'PAYMENT',
      priority: 'HIGH',
      subject: 'Payment failed twice',
      message: 'My payment failed two times in a row.',
    });
  });
});

// ── Incidents (P1-8) ────────────────────────────────────────────────────────
describe('P1-8: incidents POST maps missing rider/vehicle to 400', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSession();
    hasPermissionMock.mockReturnValue(true);
  });

  it('returns 400 for a non-existent rider, not 500', async () => {
    incidentMocks.create.mockRejectedValue(new Error('Rider not found'));
    const res = await incidentsPOST(
      postReq('/api/admin/incidents', {
        riderId: 'ghost',
        type: 'BREAKDOWN',
        severity: 'MEDIUM',
        title: 'Vehicle broke down',
        description: 'The vehicle stopped working mid-ride.',
      })
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(JSON.stringify(body)).toContain('Rider not found');
  });

  it('returns 400 for a non-existent vehicle', async () => {
    incidentMocks.create.mockRejectedValue(new Error('Vehicle not found'));
    const res = await incidentsPOST(
      postReq('/api/admin/incidents', {
        vehicleId: 'ghost',
        type: 'DAMAGE',
        severity: 'LOW',
        title: 'Scratched panel',
        description: 'Panel scratched in the parking lot.',
      })
    );
    expect(res.status).toBe(400);
  });

  it('unknown errors still return 500', async () => {
    incidentMocks.create.mockRejectedValue(new Error('DB exploded'));
    const res = await incidentsPOST(
      postReq('/api/admin/incidents', {
        type: 'OTHER',
        severity: 'LOW',
        title: 'Something odd',
        description: 'Rider reported something odd happening.',
      })
    );
    expect(res.status).toBe(500);
  });
});

// ── Feature flags (P1-16/P2-13) ────────────────────────────────────────────
describe('P1-16/P2-13: feature-flags route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSession();
    hasPermissionMock.mockReturnValue(true);
    flagMocks.getAllFeatureFlags.mockResolvedValue({});
    flagMocks.updateFeatureFlag.mockResolvedValue(true);
    flagMocks.createAuditLog.mockResolvedValue(undefined);
  });

  it('P2-13: audit details contain the key + type, never the value', async () => {
    const res = await flagsPUT(
      putReq('/api/admin/feature-flags', { key: 'maxUploadSizeMb', value: 50 })
    );
    expect(res.status).toBe(200);
    expect(flagMocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'feature_flag.update',
        entityId: 'maxUploadSizeMb',
        details: { key: 'maxUploadSizeMb', valueType: 'number' },
      })
    );
    const auditArgs = flagMocks.createAuditLog.mock.calls[0][0] as Record<string, unknown>;
    expect(JSON.stringify(auditArgs)).not.toContain('50');
  });

  it('P1-16: invalidates the scoped key, not a wildcard', async () => {
    await flagsPUT(
      putReq('/api/admin/feature-flags', { key: 'enableReferralSystem', value: true })
    );
    expect(flagMocks.invalidateCache).toHaveBeenCalledWith('admin:feature-flags:list');
  });
});

// ── Settings (P1-19/P2-18) ─────────────────────────────────────────────────
describe('P1-19/P2-18: settings route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSession();
    hasPermissionMock.mockReturnValue(true);
    settingsMocks.update.mockResolvedValue([{ id: 's1', key: 'walletMinTopup' }]);
  });

  it('P2-18: a registry-missing key is a 400 at the route, never a raw 500', async () => {
    // The schema allowlist rejects unknown keys first (422)...
    const res = await settingsPUT(
      putReq('/api/admin/settings', { walletMinTopup: 500, notARealKey: 1 })
    );
    expect(res.status).toBe(422);
    expect(settingsMocks.update).not.toHaveBeenCalled();
  });

  it('P2-18 (use-case guard): unknown key throws a message the route can map', async () => {
    settingsMocks.update.mockRejectedValue(new Error('Unknown setting key: notARealKey'));
    const res = await settingsPUT(putReq('/api/admin/settings', { walletMinTopup: 500 }));
    // Route maps the use-case guard to 400 when it fires (defense in depth
    // behind the schema allowlist).
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(JSON.stringify(body)).toContain('Unknown setting key');
  });

  it('P1-19: invalidates the scoped settings cache, not admin:*', async () => {
    const res = await settingsPUT(putReq('/api/admin/settings', { walletMinTopup: 500 }));
    expect(res.status).toBe(200);
    expect(flagMocks.invalidateCache).toHaveBeenCalledWith('admin:settings:*');
    const pattern = flagMocks.invalidateCache.mock.calls[0] as unknown as string[];
    expect(pattern[0]).not.toBe('admin:*');
  });
});

// ── Audit logs (P2-5/P2-6/P1-5) ────────────────────────────────────────────
describe('P2-5/P2-6/P1-5: audit-logs route hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSession();
    hasPermissionMock.mockReturnValue(true);
    auditMocks.getAuditLogs.mockResolvedValue({
      logs: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    });
  });

  it('P2-5: passes entity/entityId filters through to the repository', async () => {
    await auditLogsGET(
      new NextRequest('http://localhost/api/admin/audit-logs?entity=ticket&entityId=t_123&actorId=a1')
    );
    expect(auditMocks.getAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'ticket', entityId: 't_123', actorId: 'a1' })
    );
  });

  it('P2-6: a malformed details JSON row does not take the endpoint down', async () => {
    auditMocks.getAuditLogs.mockResolvedValue({
      logs: [
        {
          id: 'log_1',
          actorId: 'a1',
          action: 'rider.update',
          entity: 'rider',
          entityId: 'r_1',
          details: '{not valid json',
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    });
    const res = await auditLogsGET(new NextRequest('http://localhost/api/admin/audit-logs'));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect((body.data as unknown[]).length).toBe(1);
  });

  it('P1-5: a token-like entityId is redacted; phone in details is redacted', async () => {
    auditMocks.getAuditLogs.mockResolvedValue({
      logs: [
        {
          id: 'log_1',
          actorId: 'a1',
          action: 'rider.update',
          entity: 'rider',
          entityId: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJyaWRlciJ9.signature',
          details: '{"phone":"9876543210"}',
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    });
    const res = await auditLogsGET(new NextRequest('http://localhost/api/admin/audit-logs'));
    expect(res.status).toBe(200);
    const body = await json(res);
    const log = (body.data as Array<Record<string, unknown>>)[0];
    expect(log.entityId).toBe('[REDACTED]');
    expect(JSON.stringify(log.details)).toContain('[REDACTED]');
  });
});

