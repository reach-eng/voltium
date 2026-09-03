import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('Admin API: POST /api/admin/team-leaders/bulk', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin();
  });

  it('should return 401 if missing auth', async () => {
    const res = await api('/api/admin/team-leaders/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids: ['1', '2'], action: 'activate' }),
    });
    expect(res.status).toBe(401);
  });

  it('should return 422 for invalid body', async () => {
    const res = await api('/api/admin/team-leaders/bulk', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  it('should process bulk activate on happy path', async () => {
    const res = await api('/api/admin/team-leaders/bulk', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: JSON.stringify({ ids: ['test-tl-1', 'test-tl-2'], action: 'activate' }),
    });
    
    expect(res.status).toBe(200);
    const data = res.body;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('count');
  });
});
