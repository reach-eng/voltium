import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  access: vi.fn(),
  // mkdir is intentionally not mocked — if anything still calls it,
  // the test fails because the import is gone.
}));

const mockDb = vi.hoisted(() => ({
  systemSetting: {
    findUnique: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
  requireCronAuth: () => null,
}));

vi.mock('fs/promises', () => mockFs);
vi.mock('fs', () => ({ existsSync: mockFs.existsSync, constants: { R_OK: 4, W_OK: 2 } }));
vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/rbac', () => ({
  requireAdmin: mockAuth.requireAdmin,
  adminUnauthorized: mockAuth.adminUnauthorized,
}));
vi.mock('@/lib/cron-auth', () => ({
  requireCronAuth: mockAuth.requireCronAuth,
}));

const { GET } = await import('@/app/api/health/storage/route');

const makeReq = () => new NextRequest('http://localhost/api/health/storage');

describe('GET /api/health/storage — read-only storage check (P1-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.requireAdmin.mockResolvedValue({ adminId: 'admin-1', adminRole: 'SUPER_ADMIN' });
  });

  it('returns exists: false, writable: false for a missing path without creating it', async () => {
    mockDb.systemSetting.findUnique.mockResolvedValue({ value: '/tmp/typo_backup_root' });
    mockFs.existsSync.mockReturnValue(false);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.secondary).toMatchObject({
      exists: false,
      writable: false,
    });
    // Critical: the fix removes the mkdir side effect. We assert
    // access was called (for the case where the path exists) OR not
    // called (for the case where the path is missing). The point is
    // that no create call is made.
    expect(mockFs.access).not.toHaveBeenCalled();
  });

  it('returns exists: true, writable: true for a writable path', async () => {
    mockDb.systemSetting.findUnique.mockResolvedValue({ value: '/tmp/uploads' });
    mockFs.existsSync.mockReturnValue(true);
    mockFs.access.mockResolvedValue(undefined);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.uploads).toMatchObject({
      exists: true,
      writable: true,
    });
    expect(mockFs.access).toHaveBeenCalled();
  });

  it('returns exists: true, writable: false for an unwritable path', async () => {
    mockDb.systemSetting.findUnique.mockResolvedValue({ value: '/tmp/readonly' });
    mockFs.existsSync.mockReturnValue(true);
    mockFs.access.mockRejectedValue(new Error('EACCES'));

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.uploads).toMatchObject({
      exists: true,
      writable: false,
    });
  });
});
