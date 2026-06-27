import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted because vitest hoists vi.mock factories above imports)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  verifySessionToken: vi.fn(),
  createSessionToken: vi.fn(),
  createRefreshToken: vi.fn(),
  rider: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  verifySessionToken: mocks.verifySessionToken,
  createSessionToken: mocks.createSessionToken,
  createRefreshToken: mocks.createRefreshToken,
  SESSION_COOKIE_NAME: 'voltium-session',
  SESSION_COOKIE_OPTIONS: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60,
  },
}));

vi.mock('@/lib/db', () => ({
  db: { rider: mocks.rider },
}));

vi.mock('@/lib/logger', () => ({
  logger: mocks.logger,
}));

import { POST } from '@/app/api/auth/refresh/route';

const newAccessToken = 'new-access-token-abc';
const newRefreshToken = 'new-refresh-token-xyz';

function makeRequest(body: object): Request {
  return new Request('http://localhost/api/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/refresh (BLOCKER 1.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSessionToken.mockResolvedValue(newAccessToken);
    mocks.createRefreshToken.mockResolvedValue(newRefreshToken);
  });

  it('re-sets the rider session cookie on successful refresh', async () => {
    mocks.verifySessionToken.mockResolvedValue({
      riderDbId: 'rider-db-1',
      tokenVersion: 5,
      role: 'rider',
    });
    mocks.rider.findUnique.mockResolvedValue({
      id: 'rider-db-1',
      riderId: 'rider-1',
      phone: '9999999999',
      tokenVersion: 5,
    });
    mocks.rider.update.mockResolvedValue({ id: 'rider-db-1' });

    const response = await POST(makeRequest({ refreshToken: 'old-refresh' }) as any);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBe(newAccessToken);
    expect(body.data.refreshToken).toBe(newRefreshToken);

    // BLOCKER 1.5: cookie is re-set to the new access token
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('voltium-session=new-access-token-abc');
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it('rejects with 401 when refresh token is invalid', async () => {
    mocks.verifySessionToken.mockResolvedValue(null);

    const response = await POST(makeRequest({ refreshToken: 'bogus' }) as any);

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects with 401 when token version was revoked', async () => {
    mocks.verifySessionToken.mockResolvedValue({
      riderDbId: 'rider-db-1',
      tokenVersion: 3,
      role: 'rider',
    });
    mocks.rider.findUnique.mockResolvedValue({
      id: 'rider-db-1',
      riderId: 'rider-1',
      phone: '9999999999',
      tokenVersion: 5,
    });

    const response = await POST(makeRequest({ refreshToken: 'old-refresh' }) as any);

    expect(response.status).toBe(401);
  });

  it('rejects with 400 when no refresh token is provided', async () => {
    const response = await POST(makeRequest({}) as any);
    expect(response.status).toBe(400);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
