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
      cookie,
      json: {},
    });
    expect(res.status).toBe(422);
  });

  it('should process bulk activate on happy path', async () => {
    const res = await api('/api/admin/hubs/bulk', {
      method: 'POST',
      cookie,
      json: { ids: ['test-hub-1', 'test-hub-2'], action: 'activate' },
    });

    expect(res.status).toBe(200);
    // The `api()` helper returns `{ status, body, headers }` — not
    // a fetch Response. The test was calling `res.json()` which
    // throws `res.json is not a function`. Use `res.body` directly.
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('count');
  });
});
