/**
 * TG-9 (2026-08-05 ops audit) — PUT /api/admin/team-leaders rejects empty
 * update bodies. Previously `{id}` alone passed the partial schema and hit the
 * repository as a no-op update that still wrote an audit entry — spam polluted
 * the audit trail with meaningless "team leader updated" rows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
  hasPermission: vi.fn(),
  update: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: mocks.adminForbidden,
}));

vi.mock('@/lib/auth', () => ({ hasPermission: mocks.hasPermission }));

vi.mock('@/server/modules/team-leaders/team-leader.use-cases', () => ({
  teamLeaderUseCases: { update: mocks.update },
}));

import { PUT } from '@/app/api/admin/team-leaders/route';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/team-leaders', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

describe('TG-9: team-leaders PUT rejects empty update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'OPERATIONS_ADMIN' });
    mocks.hasPermission.mockReturnValue(true);
  });

  it('rejects { id } only with 400', async () => {
    const res = await PUT(makeRequest({ id: 'tl_123' }));
    expect(res.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects {} with a validation error (id is required)', async () => {
    // `{}` never reaches the empty-update guard — the schema requires id.
    const res = await PUT(makeRequest({}));
    expect([400, 422]).toContain(res.status);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('accepts a real field change', async () => {
    mocks.update.mockResolvedValue({ id: 'tl_123', name: 'Lead' });
    const res = await PUT(makeRequest({ id: 'tl_123', name: 'Lead' }));
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalled();
  });
});
