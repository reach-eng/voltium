import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  verifySessionToken: vi.fn(),
  createSessionToken: vi.fn(),
  createRefreshToken: vi.fn(),
  admin: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/auth', () => ({
  verifySessionToken: mocks.verifySessionToken,
  createSessionToken: mocks.createSessionToken,
  createRefreshToken: mocks.createRefreshToken,
  ADMIN_SESSION_COOKIE_NAME: 'voltium-admin-session',
  ADMIN_SESSION_PHONE_MARKER: 'admin',
  ACCESS_TOKEN_TTL_SECONDS: 2 * 60 * 60,
  SESSION_COOKIE_OPTIONS: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 604800,
  },
}));

vi.mock('@/lib/db', () => ({ db: { admin: mocks.admin } }));
vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

// session-rotation is intentionally NOT mocked so the sliding-window grace
// is exercised for real.
import { POST } from '@/app/api/admin/auth/refresh/route';
import { recordTokenBump, _resetSessionRotationForTests } from '@/lib/session-rotation';

const newAccessToken = 'new-access-token-abc';
const newRefreshToken = 'new-refresh-token-xyz';

function makeRequest(body: unknown): any {
  return new Request('http://localhost/api/admin/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function adminRow(overrides: Partial<{ id: string; tokenVersion: number; isActive: boolean; permissions: string | null }> = {}) {
  return {
    id: 'admin-1',
    email: 'admin@voltium.in',
    role: 'SUPER_ADMIN',
    tokenVersion: 1,
    isActive: true,
    permissions: '["riders_view"]',
    ...overrides,
  };
}

describe('POST /api/admin/auth/refresh (P0-3 / P0-9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSessionRotationForTests();
    mocks.createSessionToken.mockResolvedValue(newAccessToken);
    mocks.createRefreshToken.mockResolvedValue(newRefreshToken);
  });

  it('refreshes a valid refresh token and re-sets the session cookie', async () => {
    mocks.verifySessionToken.mockResolvedValue({
      riderId: 'admin-1',
      riderDbId: 'admin-1',
      phone: 'admin@voltium.in',
      role: 'admin',
      adminId: 'admin-1',
      adminRole: 'SUPER_ADMIN',
      type: 'refresh',
      tokenVersion: 1,
    });
    mocks.admin.findUnique.mockResolvedValue(adminRow());
    mocks.admin.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest({ refreshToken: 'valid-refresh' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.token).toBe(newAccessToken);
    expect(body.data.refreshToken).toBe(newRefreshToken);
    // P1-12: the reported TTL matches the real 2h access-token TTL.
    expect(body.data.expiresIn).toBe(2 * 60 * 60);
    expect(res.headers.get('set-cookie')).toContain('voltium-admin-session=new-access-token-abc');
    // Rotation happened: old version 1 -> 2
    expect(mocks.admin.updateMany).toHaveBeenCalledWith({
      where: { id: 'admin-1', tokenVersion: 1 },
      data: { tokenVersion: { increment: 1 } },
    });
  });

  it('mints tokens with the admin phone marker, never the email (P1-8)', async () => {
    mocks.verifySessionToken.mockResolvedValue({
      riderId: 'admin-1',
      riderDbId: 'admin-1',
      phone: 'admin',
      role: 'admin',
      adminId: 'admin-1',
      adminRole: 'SUPER_ADMIN',
      type: 'refresh',
      tokenVersion: 1,
    });
    mocks.admin.findUnique.mockResolvedValue(adminRow());
    mocks.admin.updateMany.mockResolvedValue({ count: 1 });

    await POST(makeRequest({ refreshToken: 'valid-refresh' }));

    expect(mocks.createSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({ phone: 'admin' })
    );
    expect(mocks.createRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ phone: 'admin' })
    );
  });

  it('rejects an access token passed as refreshToken (TG-1 / P0-3)', async () => {
    // Access tokens carry no `type` claim
    mocks.verifySessionToken.mockResolvedValue({
      riderId: 'admin-1',
      riderDbId: 'admin-1',
      phone: 'admin@voltium.in',
      role: 'admin',
      adminId: 'admin-1',
      adminRole: 'SUPER_ADMIN',
      tokenVersion: 1,
    });

    const res = await POST(makeRequest({ refreshToken: 'an-access-token' }));

    expect(res.status).toBe(401);
    expect(mocks.admin.findUnique).not.toHaveBeenCalled();
    expect(mocks.createRefreshToken).not.toHaveBeenCalled();
  });

  it('rejects a rider token on the admin refresh endpoint', async () => {
    mocks.verifySessionToken.mockResolvedValue({
      riderId: 'rider-1',
      riderDbId: 'rider-1',
      phone: '9999999999',
      role: 'rider',
      type: 'refresh',
      tokenVersion: 1,
    });

    const res = await POST(makeRequest({ refreshToken: 'rider-refresh' }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when no refreshToken is provided', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 (not 500) for a malformed JSON body (P2-7)', async () => {
    const req = new Request('http://localhost/api/admin/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });

    const res = await POST(req as any);

    expect(res.status).toBe(400);
    expect(mocks.verifySessionToken).not.toHaveBeenCalled();
  });

  it('rejects a token whose version is far behind with no grace record', async () => {
    mocks.verifySessionToken.mockResolvedValue({
      riderId: 'admin-1',
      riderDbId: 'admin-1',
      phone: 'admin@voltium.in',
      role: 'admin',
      adminId: 'admin-1',
      type: 'refresh',
      tokenVersion: 1,
    });
    mocks.admin.findUnique.mockResolvedValue(adminRow({ tokenVersion: 3 }));

    const res = await POST(makeRequest({ refreshToken: 'old-refresh' }));

    expect(res.status).toBe(401);
  });

  it('rejects when the admin is deactivated', async () => {
    mocks.verifySessionToken.mockResolvedValue({
      riderId: 'admin-1',
      riderDbId: 'admin-1',
      phone: 'admin@voltium.in',
      role: 'admin',
      adminId: 'admin-1',
      type: 'refresh',
      tokenVersion: 1,
    });
    mocks.admin.findUnique.mockResolvedValue(adminRow({ isActive: false }));

    const res = await POST(makeRequest({ refreshToken: 'x' }));

    expect(res.status).toBe(401);
  });

  it('accepts a racing retry one version behind within the sliding window (P0-9)', async () => {
    // Simulate a refresh that already rotated 1 -> 2 a moment ago.
    recordTokenBump('admin-race', 1, 2);

    mocks.verifySessionToken.mockResolvedValue({
      riderId: 'admin-race',
      riderDbId: 'admin-race',
      phone: 'admin@voltium.in',
      role: 'admin',
      adminId: 'admin-race',
      type: 'refresh',
      tokenVersion: 1,
    });
    mocks.admin.findUnique.mockResolvedValue(adminRow({ id: 'admin-race', tokenVersion: 2 }));
    mocks.admin.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(makeRequest({ refreshToken: 'same-old-refresh-retry' }));

    expect(res.status).toBe(200);
    // Must NOT rotate again — it reissues at the current version
    expect(mocks.admin.updateMany).not.toHaveBeenCalled();
    // New tokens carry the current version
    expect(mocks.createSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({ tokenVersion: 2 })
    );
  });

  it('rejects a token two versions behind even within the window', async () => {
    recordTokenBump('admin-two-behind', 1, 2);

    mocks.verifySessionToken.mockResolvedValue({
      riderId: 'admin-two-behind',
      riderDbId: 'admin-two-behind',
      phone: 'admin@voltium.in',
      role: 'admin',
      adminId: 'admin-two-behind',
      type: 'refresh',
      tokenVersion: 1,
    });
    mocks.admin.findUnique.mockResolvedValue(adminRow({ id: 'admin-two-behind', tokenVersion: 3 }));

    const res = await POST(makeRequest({ refreshToken: 'stale' }));

    expect(res.status).toBe(401);
  });

  it('rejects a retry when the current version was NOT produced by our rotation (logout)', async () => {
    // No recordTokenBump for this admin — the version moved via logout.
    mocks.verifySessionToken.mockResolvedValue({
      riderId: 'admin-logged-out',
      riderDbId: 'admin-logged-out',
      phone: 'admin@voltium.in',
      role: 'admin',
      adminId: 'admin-logged-out',
      type: 'refresh',
      tokenVersion: 1,
    });
    mocks.admin.findUnique.mockResolvedValue(adminRow({ id: 'admin-logged-out', tokenVersion: 2 }));

    const res = await POST(makeRequest({ refreshToken: 'stolen' }));

    expect(res.status).toBe(401);
  });
});
