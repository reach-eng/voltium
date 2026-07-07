import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('Admin API: POST /api/admin/hubs/bulk', () => {
  let cookie: string;

  beforeAll(async () => {
    const login = await adminLogin({ role: 'super_admin' });
    cookie = login.cookie;
  });

  it('should return 401 if missing auth', async () => {
    const res = await api('/api/admin/hubs/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids: ['1', '2'], action: 'activate' }),
    });
    expect(res.status).toBe(401);
  });

  it('should return 422 for invalid body', async () => {
    const res = await api('/api/admin/hubs/bulk', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  it('should process bulk activate on happy path', async () => {
    const res = await api('/api/admin/hubs/bulk', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: JSON.stringify({ ids: ['test-hub-1', 'test-hub-2'], action: 'activate' }),
    });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('count');
  });
});
