import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  rateLimitIdentifierFromRequest: vi.fn(),
  createSessionToken: vi.fn(),
  createRefreshToken: vi.fn(),
  login: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  redactPii: vi.fn((err: unknown) => err),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  AUTH_RATE_LIMIT: { windowMs: 15 * 60 * 1000, maxRequests: 5, failClosed: true },
}));

vi.mock('@/lib/rate-limit-middleware', () => ({
  rateLimitIdentifierFromRequest: mocks.rateLimitIdentifierFromRequest,
}));

vi.mock('@/lib/auth', () => ({
  createSessionToken: mocks.createSessionToken,
  createRefreshToken: mocks.createRefreshToken,
  ADMIN_SESSION_COOKIE_NAME: 'voltium-admin-session',
  ADMIN_SESSION_PHONE_MARKER: 'admin',
  SESSION_COOKIE_OPTIONS: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 604800,
  },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));
vi.mock('@/lib/pii-redact', () => ({ redactPii: mocks.redactPii }));

// The LoginError class is imported by the route from its own module (not
// from the use-cases module), so tests throw the real class and instanceof
// matching works.
vi.mock('@/server/modules/admin/admin.use-cases', () => ({
  adminUseCases: { login: mocks.login },
}));

import { POST } from '@/app/api/admin/auth/login/route';
import { LoginError } from '@/server/modules/admin/login-error';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const adminRow = {
  id: 'admin-1',
  email: 'admin@voltium.in',
  name: 'Raj',
  role: 'SUPER_ADMIN',
  permissions: '["riders_view"]',
  tokenVersion: 3,
};

describe('POST /api/admin/auth/login (P0-4 / P0-7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimitIdentifierFromRequest.mockReturnValue('ip:1.2.3.4');
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 1000 });
    mocks.createSessionToken.mockResolvedValue('signed-token');
    mocks.createRefreshToken.mockResolvedValue('refresh-token-abc');
  });

  it('returns 429 when the per-IP limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

    const res = await POST(makeRequest({ email: 'admin@voltium.in', password: 'x' }));

    expect(res.status).toBe(429);
    // The per-email limiter must not even run
    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);
  });

  it('returns 429 when the per-email limit is exceeded (P0-4 botnet protection)', async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 4, resetAt: Date.now() + 1000 });
    mocks.checkRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

    const res = await POST(makeRequest({ email: 'ADMIN@VOLTIUM.IN', password: 'x' }));

    expect(res.status).toBe(429);
    // Key is normalized to lowercase and scoped per email, not per IP
    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(2, 'admin-login:email:admin@voltium.in', expect.anything());
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('maps INVALID_CREDENTIALS to 401 (P0-7 typed, no string matching)', async () => {
    mocks.login.mockRejectedValue(new LoginError('Invalid email or password', 'INVALID_CREDENTIALS'));

    const res = await POST(makeRequest({ email: 'admin@voltium.in', password: 'wrong' }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toContain('Invalid email or password');
  });

  it('maps ACCOUNT_DEACTIVATED to 403 (P0-7)', async () => {
    mocks.login.mockRejectedValue(
      new LoginError('Account deactivated. Contact an administrator.', 'ACCOUNT_DEACTIVATED')
    );

    const res = await POST(makeRequest({ email: 'admin@voltium.in', password: 'right' }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toContain('deactivated');
  });

  it('returns 500 for unexpected errors', async () => {
    mocks.login.mockRejectedValue(new Error('database exploded'));

    const res = await POST(makeRequest({ email: 'admin@voltium.in', password: 'x' }));

    expect(res.status).toBe(500);
    expect(mocks.logger.error).toHaveBeenCalled();
  });

  it('returns 400 for a non-JSON body', async () => {
    const req = new Request('http://localhost/api/admin/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 422 for an invalid email', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', password: 'x' }));
    expect(res.status).toBe(422);
  });

  it('returns 200 and sets the admin session cookie on success', async () => {
    mocks.login.mockResolvedValue(adminRow);

    const res = await POST(makeRequest({ email: 'admin@voltium.in', password: 'right' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('voltium-admin-session=signed-token');
    // Permissions column parsed from JSON via the shared helper
    expect(mocks.createSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({ adminPermissions: ['riders_view'] })
    );
  });

  it('returns a refresh token for the client interceptor (P1-13)', async () => {
    mocks.login.mockResolvedValue(adminRow);

    const res = await POST(makeRequest({ email: 'admin@voltium.in', password: 'right' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.refreshToken).toBe('refresh-token-abc');
    // Both tokens are minted with the same payload
    expect(mocks.createRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ tokenVersion: 3 })
    );
  });

  it('never puts the admin email in the JWT phone field (P1-8)', async () => {
    mocks.login.mockResolvedValue(adminRow);

    await POST(makeRequest({ email: 'admin@voltium.in', password: 'right' }));

    expect(mocks.createSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({ phone: 'admin' })
    );
    expect(mocks.createRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ phone: 'admin' })
    );
  });

  it('records the source IP in the login log (P2-2 / P3-8)', async () => {
    mocks.login.mockResolvedValue(adminRow);

    await POST(makeRequest({ email: 'admin@voltium.in', password: 'right' }));

    expect(mocks.logger.info).toHaveBeenCalledWith(
      '[Admin Login]',
      expect.objectContaining({ adminId: 'admin-1', role: 'SUPER_ADMIN', ip: '1.2.3.4' })
    );
  });

  it('rejects cross-origin login requests (P3-6 CSRF defense-in-depth)', async () => {
    const req = new Request('http://localhost/api/admin/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
      },
      body: JSON.stringify({ email: 'admin@voltium.in', password: 'right' }),
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    // The rate limiter must not even run for a rejected cross-origin call
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('allows same-origin requests (P3-6)', async () => {
    mocks.login.mockResolvedValue(adminRow);
    const req = new Request('http://localhost/api/admin/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost',
      },
      body: JSON.stringify({ email: 'admin@voltium.in', password: 'right' }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
  });
});
