/**
 * 9.5+ Hardening (T-9P0-2) — regression suite for the `?token=` removal
 * from `web/src/lib/get-session.ts`.
 *
 * Why this is a unit test (and not in tests/security/):
 *   The test mocks `verifySessionToken` so the assertions are about
 *   `getSession` / `getAdminSession` control flow — no dev server, no DB,
 *   no network. Putting it next to other mocked-helper tests in
 *   `tests/unit/` keeps the unit-suite green independent of the live
 *   server probe in `vitest.config.ts`.
 *
 * Invariants pinned here:
 *   1. `?token=<valid>` does NOT authenticate (returns null).
 *   2. `verifySessionToken` is NOT called when only `?token=` is present.
 *   3. `Authorization: Bearer <valid>` still authenticates.
 *   4. Cookie path still authenticates (unchanged behavior).
 *   5. The same guarantees hold for the admin variant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { verifySessionToken, cookieJar } = vi.hoisted(() => ({
  verifySessionToken: vi.fn(),
  cookieJar: {} as Record<string, string | undefined>,
}));

vi.mock('@/lib/auth', () => ({
  verifySessionToken,
  SESSION_COOKIE_NAME: 'voltium-session',
  ADMIN_SESSION_COOKIE_NAME: 'voltium-admin-session',
}));

// Stub `next/headers` `cookies()` so the cookie path is observable. We
// flip a per-test value to simulate "cookie present" / "no cookie".
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar[name]
        ? { name, value: cookieJar[name]! }
        : undefined,
  }),
}));

import { getSession, getAdminSession } from '@/lib/get-session';

describe('session query-token rejection (9.5+ T-9P0-2)', () => {
  beforeEach(() => {
    verifySessionToken.mockReset();
    verifySessionToken.mockResolvedValue({
      riderDbId: 'rider-1',
      phone: '9999900001',
      role: 'rider',
    } as any);
    for (const k of Object.keys(cookieJar)) delete cookieJar[k];
  });

  it('rider: ?token= does not authenticate (returns null)', async () => {
    const request = new Request('http://localhost/api/rider/profile?token=valid-token');
    const session = await getSession(request);

    expect(session).toBeNull();
    expect(verifySessionToken).not.toHaveBeenCalled();
  });

  it('rider: Authorization Bearer still authenticates', async () => {
    const request = new Request('http://localhost/api/rider/profile', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const session = await getSession(request);

    expect(session).toEqual({
      riderDbId: 'rider-1',
      phone: '9999900001',
      role: 'rider',
    });
    expect(verifySessionToken).toHaveBeenCalledWith('valid-token');
  });

  it('rider: cookie still authenticates', async () => {
    cookieJar['voltium-session'] = 'cookie-token';
    const session = await getSession(new Request('http://localhost/api/rider/profile'));

    expect(session).not.toBeNull();
    expect(verifySessionToken).toHaveBeenCalledWith('cookie-token');
  });

  it('rider: ?token= is ignored even when cookie is also absent', async () => {
    const request = new Request('http://localhost/api/rider/profile?token=anything');
    const session = await getSession(request);

    expect(session).toBeNull();
    expect(verifySessionToken).not.toHaveBeenCalled();
  });

  it('admin: ?token= does not authenticate (returns null)', async () => {
    const request = new Request('http://localhost/api/admin/dashboard?token=admin-token');
    const session = await getAdminSession(request);

    expect(session).toBeNull();
    expect(verifySessionToken).not.toHaveBeenCalled();
  });

  it('admin: Authorization Bearer with admin role authenticates', async () => {
    verifySessionToken.mockResolvedValueOnce({
      riderDbId: 'admin-1',
      role: 'admin',
    } as any);

    const request = new Request('http://localhost/api/admin/dashboard', {
      headers: { Authorization: 'Bearer admin-token' },
    });
    const session = await getAdminSession(request);

    expect(session).not.toBeNull();
    expect(verifySessionToken).toHaveBeenCalledWith('admin-token');
  });

  it('admin: ?token= with a non-admin token is still rejected', async () => {
    verifySessionToken.mockResolvedValueOnce({
      riderDbId: 'rider-1',
      role: 'rider',
    } as any);

    const request = new Request('http://localhost/api/admin/dashboard?token=rider-token');
    const session = await getAdminSession(request);

    // No verification attempted (token path removed), so the role-check
    // never even runs. Result is null.
    expect(session).toBeNull();
    expect(verifySessionToken).not.toHaveBeenCalled();
  });

  it('admin: cookie still authenticates', async () => {
    verifySessionToken.mockResolvedValueOnce({
      riderDbId: 'admin-1',
      role: 'admin',
    } as any);
    cookieJar['voltium-admin-session'] = 'admin-cookie';
    const session = await getAdminSession(new Request('http://localhost/api/admin/dashboard'));

    expect(session).not.toBeNull();
    expect(verifySessionToken).toHaveBeenCalledWith('admin-cookie');
  });
});
