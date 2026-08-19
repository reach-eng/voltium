import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  getMe: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/get-session', () => ({ getAdminSession: mocks.getAdminSession }));
vi.mock('@/server/modules/admin/admin.use-cases', () => ({
  adminUseCases: { getMe: mocks.getMe },
}));
vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

import { GET } from '@/app/api/admin/auth/me/route';

const session = {
  riderId: 'admin-1',
  riderDbId: 'admin-1',
  phone: 'admin@voltium.in',
  role: 'admin',
  adminId: 'admin-1',
  adminRole: 'SUPER_ADMIN',
};

describe('GET /api/admin/auth/me (P0-8 / TG-5 / TG-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mocks.getAdminSession.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/api/admin/auth/me'));

    expect(res.status).toBe(401);
  });

  it('returns the admin profile without the password hash (TG-6)', async () => {
    mocks.getAdminSession.mockResolvedValue(session);
    mocks.getMe.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@voltium.in',
      name: 'Raj',
      role: 'SUPER_ADMIN',
      isActive: true,
      permissions: ['riders_view'],
      adminPermissions: ['riders_view'],
    });

    const res = await GET(new Request('http://localhost/api/admin/auth/me'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.isActive).toBe(true);
    expect(body.data.permissions).toEqual(['riders_view']);
    expect(body.data).not.toHaveProperty('password');
    expect(JSON.stringify(body)).not.toContain('$argon2');
  });

  it('strips the password hash even if getMe leaks it (P2-9/P2-10 defense-in-depth)', async () => {
    mocks.getAdminSession.mockResolvedValue(session);
    mocks.getMe.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@voltium.in',
      name: 'Raj',
      role: 'SUPER_ADMIN',
      isActive: true,
      permissions: ['riders_view'],
      adminPermissions: ['riders_view'],
      // A future getMe regression must not leak the hash through the route.
      password: '$argon2id$v=19$m=65536$c29tZXNhbHQ$eGhhc2g',
    });

    const res = await GET(new Request('http://localhost/api/admin/auth/me'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).not.toHaveProperty('password');
    expect(JSON.stringify(body)).not.toContain('$argon2id');
  });

  it('returns 403 when the admin is deactivated (TG-5, not 500)', async () => {
    mocks.getAdminSession.mockResolvedValue(session);
    mocks.getMe.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@voltium.in',
      role: 'SUPER_ADMIN',
      isActive: false,
      permissions: [],
      adminPermissions: [],
    });

    const res = await GET(new Request('http://localhost/api/admin/auth/me'));

    expect(res.status).toBe(403);
  });

  it('returns 503 (not 403) when the DB query fails (P0-8)', async () => {
    mocks.getAdminSession.mockResolvedValue(session);
    mocks.getMe.mockRejectedValue(new Error('connection refused'));

    const res = await GET(new Request('http://localhost/api/admin/auth/me'));

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns 401 when the admin record does not exist', async () => {
    mocks.getAdminSession.mockResolvedValue(session);
    mocks.getMe.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/api/admin/auth/me'));

    expect(res.status).toBe(401);
  });
});
