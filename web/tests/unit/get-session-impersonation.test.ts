import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return {
    ...actual,
    isDevelopmentEnv: () => true,
    isProductionEnv: () => false,
  };
});

import { getAdminId } from '@/lib/get-session';

describe('getAdminId — x-admin-id header scoping', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ENABLE_RIDER_IMPERSONATION: 'true', NODE_ENV: 'development' };
  });

  it('honors x-admin-id header on /api/admin/impersonate route', async () => {
    const req = new Request('http://localhost/api/admin/impersonate', {
      headers: { 'x-admin-id': 'admin-impersonator-id' },
    });

    const adminId = await getAdminId(req);
    expect(adminId).toBe('admin-impersonator-id');
  });

  it('ignores x-admin-id header on non-impersonation routes', async () => {
    const req = new Request('http://localhost/api/rider/profile', {
      headers: { 'x-admin-id': 'admin-attacker-id' },
    });

    const adminId = await getAdminId(req);
    expect(adminId).toBeNull();
  });
});
