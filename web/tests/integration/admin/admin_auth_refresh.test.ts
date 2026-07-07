import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../../helpers';

describe('POST /api/admin/auth/refresh', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
  });

  it('should successfully refresh the admin token', async () => {
    const { status, body, headers } = await api('/api/admin/auth/refresh', {
      method: 'POST',
      cookie: adminCookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('token');
    expect(body.data).toHaveProperty('refreshToken');
    expect(body.data).toHaveProperty('expiresIn');
    
    const setCookie = headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
  });

  it('should return 401 Unauthorized if admin cookie is missing', async () => {
    const { status, body } = await api('/api/admin/auth/refresh', {
      method: 'POST',
    });

    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });
});
