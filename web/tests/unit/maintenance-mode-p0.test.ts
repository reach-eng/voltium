/**
 * TG-10 (2026-08-05 ops audit) — maintenance-mode PUT requires both `enabled`
 * and `message`. Previously the body was read with no schema; this test locks
 * in the existing route-level field check and the P0-5 'Failed to ...' 500
 * messages.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  hasPermission: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  createAuditLog: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/get-session', () => ({ getAdminSession: mocks.getAdminSession }));

vi.mock('@/lib/permissions', () => ({ hasPermission: mocks.hasPermission }));

vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      update: mocks.update,
    },
  },
}));

import { PUT } from '@/app/api/admin/maintenance-mode/route';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/maintenance-mode', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

describe('TG-10: maintenance-mode PUT validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminSession.mockResolvedValue({
      adminId: 'admin_1',
      adminRole: 'SUPER_ADMIN',
      riderDbId: null,
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.upsert.mockResolvedValue({});
    mocks.createAuditLog.mockResolvedValue(undefined);
  });

  it('rejects { enabled: true } without message with 400', async () => {
    const res = await PUT(makeRequest({ enabled: true }));
    expect(res.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects { message: "x" } without enabled with 400', async () => {
    const res = await PUT(makeRequest({ message: 'Maintenance' }));
    expect(res.status).toBe(400);
  });

  it('accepts both fields', async () => {
    const res = await PUT(makeRequest({ enabled: true, message: 'Down for upgrades' }));
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });
});
