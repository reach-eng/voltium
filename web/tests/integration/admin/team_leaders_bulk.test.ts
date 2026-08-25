import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('Admin API: POST /api/admin/team-leaders/bulk', () => {
  let cookie: string;

  beforeAll(async () => {
    const login = await adminLogin({ role: 'super_admin' });
    cookie = login.cookie;
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
      cookie,
      json: {},
    });
    expect(res.status).toBe(422);
  });

  it('should process bulk activate on happy path', async () => {
    const res = await api('/api/admin/team-leaders/bulk', {
      method: 'POST',
      cookie,
      json: { ids: ['test-tl-1', 'test-tl-2'], action: 'activate' },
    });

    expect(res.status).toBe(200);
    // The `api()` helper returns `{ status, body, headers }` — use
    // `res.body` directly, not `res.json()` (which doesn't exist).
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('count');
  });
});
