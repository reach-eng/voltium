import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// P1-16: logout audit entries carry the source IP (even when the session is
// missing, actorId falls back to 'system' but the origin is still recorded).
// P1-17: the cookie is cleared with the shared SESSION_COOKIE_OPTIONS
// (sameSite strict, APP_ENV-aware secure) rather than a hand-rolled copy.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createAuditLog: vi.fn(),
  rateLimitIdentifierFromRequest: vi.fn(),
  logout: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/rbac', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));
vi.mock('@/lib/rate-limit-middleware', () => ({
  rateLimitIdentifierFromRequest: mocks.rateLimitIdentifierFromRequest,
}));
vi.mock('@/server/modules/admin/admin.use-cases', () => ({
  adminUseCases: { logout: mocks.logout },
}));
vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

// SESSION_COOKIE_OPTIONS mirrors lib/auth.ts (sameSite strict, secure from
// APP_ENV) — the logout route must spread it, not rebuild it.
vi.mock('@/lib/auth', () => ({
  ADMIN_SESSION_COOKIE_NAME: 'voltium-admin-session',
  SESSION_COOKIE_OPTIONS: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 604800,
  },
}));

import { POST } from '@/app/api/admin/auth/logout/route';

function makeRequest(): Request {
  return new Request('http://localhost/api/admin/auth/logout', { method: 'POST' });
}

describe('POST /api/admin/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimitIdentifierFromRequest.mockReturnValue('ip:203.0.113.7');
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.logout.mockResolvedValue(undefined);
  });

  it('records the source IP in the audit log (P1-16)', async () => {
    mocks.requireAdmin.mockResolvedValue({
      riderId: 'admin-1',
      riderDbId: 'admin-1',
      phone: 'admin',
      role: 'admin',
      adminId: 'admin-1',
    });

    await POST(makeRequest());

    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: 'admin.logout',
        details: { ip: '203.0.113.7' },
      })
    );
    // TG-7: the session is actually invalidated — the use-case bumps the
    // tokenVersion so the old refresh/access tokens stop verifying.
    expect(mocks.logout).toHaveBeenCalledWith('admin-1');
  });

  it('writes no phantom system-actor audit row when there is no session', async () => {
    mocks.requireAdmin.mockResolvedValue(null);

    const res = await POST(makeRequest());

    // P1-16: a logout with no valid session is a no-op — don't spam the
    // audit log with un-attributable 'system' entries.
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
    // The cookie is still cleared so the client ends up logged out.
    const setCookie = (res.headers.get('set-cookie') || '').toLowerCase();
    expect(setCookie).toContain('max-age=0');
  });

  it('clears the cookie with the shared options (P1-17)', async () => {
    mocks.requireAdmin.mockResolvedValue(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const setCookie = (res.headers.get('set-cookie') || '').toLowerCase();
    expect(setCookie).toContain('voltium-admin-session=');
    expect(setCookie).toContain('max-age=0');
    // P1-17: the shared options keep sameSite strict (the old hand-rolled
    // clear dropped it to 'lax') and the secure flag.
    expect(setCookie).toContain('samesite=strict');
    expect(setCookie).toContain('secure');
  });
});
