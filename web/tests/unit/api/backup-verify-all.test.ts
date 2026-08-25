import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSession = {
  adminId: 'admin-1',
  role: 'admin',
  adminRole: 'SUPER_ADMIN',
};

vi.mock('@/lib/get-session', () => ({
  getAdminSession: vi.fn().mockResolvedValue(mockSession),
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 2, resetAt: Date.now() + 60000 }),
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/modules/data-management/backup.repository', () => ({
  backupRepository: {
    listBackupJobs: vi.fn().mockResolvedValue({
      items: [
        { id: 'backup-1', status: 'COMPLETED' },
        { id: 'backup-2', status: 'COMPLETED' },
      ],
      total: 2,
    }),
  },
}));

vi.mock('@/server/modules/data-management/data-management.use-cases', () => ({
  dataManagementUseCases: {
    verifyBackup: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
  },
}));

const { POST } = await import('@/app/api/admin/data-management/backups/verify-all/route');

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/admin/data-management/backups/verify-all', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/admin/data-management/backups/verify-all (F-006)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const { getAdminSession } = await import('@/lib/get-session');
    vi.mocked(getAdminSession).mockResolvedValueOnce(null as any);

    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('rejects requests without data_management_view permission with 403', async () => {
    const { hasPermission } = await import('@/lib/permissions');
    vi.mocked(hasPermission).mockReturnValueOnce(false);

    const res = await POST(makeReq());
    expect(res.status).toBe(403);
  });

  it('enforces 3/min/admin rate limit and returns 429 when exceeded', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(429);
  });

  it('verifies all completed backups and creates backup.verify_all audit log', async () => {
    const { createAuditLog } = await import('@/lib/audit-log');
    const { dataManagementUseCases } = await import('@/server/modules/data-management/data-management.use-cases');

    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.total).toBe(2);
    expect(json.data.verified).toBe(2);
    expect(json.data.failed).toBe(0);

    expect(dataManagementUseCases.verifyBackup).toHaveBeenCalledTimes(2);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'backup.verify_all',
        actorId: 'admin-1',
        entity: 'BackupJob',
        details: {
          total: 2,
          verified: 2,
          failed: 0,
        },
      })
    );
  });
});
