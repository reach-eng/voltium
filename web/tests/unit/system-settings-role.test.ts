import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  hasPermission: vi.fn(),
  findUnique: vi.fn(),
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
      update: mocks.update,
    },
  },
}));

import { PUT } from '@/app/api/admin/system-settings/route';

function makePutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/system-settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

describe('System Settings PUT Role Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects PUT request when admin is not SUPER_ADMIN even if settings_manage is true', async () => {
    mocks.getAdminSession.mockResolvedValue({
      adminId: 'admin_ops',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);

    const res = await PUT(makePutRequest({ key: 'APP_PUBLIC_URL', value: 'https://app.voltium.io' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error?.message).toContain('Super Admin');
  });

  it('allows PUT request when admin has settings_manage AND is SUPER_ADMIN', async () => {
    mocks.getAdminSession.mockResolvedValue({
      adminId: 'super_admin_1',
      adminRole: 'SUPER_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.findUnique.mockResolvedValue({ key: 'APP_PUBLIC_URL', isEditable: true, isSecret: false });
    mocks.update.mockResolvedValue({});
    mocks.createAuditLog.mockResolvedValue(undefined);

    const res = await PUT(makePutRequest({ key: 'APP_PUBLIC_URL', value: 'https://app.voltium.io' }));
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { key: 'APP_PUBLIC_URL' },
      data: {
        value: 'https://app.voltium.io',
        updatedByAdminId: 'super_admin_1',
      },
    });
  });
});
