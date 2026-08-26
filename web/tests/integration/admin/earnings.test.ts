import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('Admin API: /api/admin/earnings', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin();
  });

  it('GET /api/admin/earnings - happy path', async () => {
    const { status, body } = await api('/api/admin/earnings?limit=5', {
      method: 'GET',
      cookie,
    });
    
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET /api/admin/earnings - unauthenticated', async () => {
    const { status, body } = await api('/api/admin/earnings', {
      method: 'GET',
    });
    
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });
});
