import { describe, it, expect, beforeAll } from 'vitest';
import { api } from '../../helpers';
import { resolveAdminCredentials } from '../../admin-auth-helper';

describe('POST /api/admin/auth/refresh', () => {
  let refreshToken: string;
  let adminCookie: string;

  beforeAll(async () => {
    // P1-11: the route reads refreshToken from the JSON body — log in through
    // the real endpoint and use the refresh token it returns.
    const candidates = resolveAdminCredentials();
    for (const { email, password } of candidates) {
      const res = await api('/api/admin/auth/login', {
        method: 'POST',
        json: { email, password },
      });
      if (res.status === 200) {
        refreshToken = res.body.data.refreshToken;
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) adminCookie = setCookie.split(';')[0];
        break;
      }
    }
    if (!refreshToken) {
      throw new Error(
        'Could not log in to obtain a refresh token — set TEST_ADMIN_EMAIL/PASSWORD ' +
          'or ADMIN_PASSWORD / SEED_ADMIN_PASSWORD.'
      );
    }
  });

  it('should successfully refresh the admin token', async () => {
    const { status, body, headers } = await api('/api/admin/auth/refresh', {
      method: 'POST',
      json: { refreshToken },
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('token');
    expect(body.data).toHaveProperty('refreshToken');
    // P1-12: the reported TTL is the real 2h access-token TTL.
    expect(body.data.expiresIn).toBe(2 * 60 * 60);

    const setCookie = headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
  });

  it('should return 400 Bad Request when no refreshToken is provided', async () => {
    const { status, body } = await api('/api/admin/auth/refresh', {
      method: 'POST',
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  // TG-1: an access token (no `type: 'refresh'` claim) must be rejected.
  it('rejects an access token passed as refreshToken (TG-1 / P0-3)', async () => {
    // The session cookie holds the access token — pass its value as the body
    // refreshToken; the route must reject it.
    const accessToken = adminCookie ? adminCookie.split('=')[1] : undefined;
    const { status, body } = await api('/api/admin/auth/refresh', {
      method: 'POST',
      json: { refreshToken: accessToken },
    });

    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });
});
