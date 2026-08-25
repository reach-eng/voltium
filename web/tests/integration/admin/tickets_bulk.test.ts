import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('Admin API: POST /api/admin/tickets/bulk', () => {
  let cookie: string;

  beforeAll(async () => {
    const login = await adminLogin({ role: 'super_admin' });
    cookie = login.cookie;
  });

  it('should return 401 if missing auth', async () => {
    const res = await api('/api/admin/tickets/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids: ['1'], action: 'changeStatus', value: 'closed' }),
    });
    expect(res.status).toBe(401);
  });

  it('should return 422 for invalid body', async () => {
    const res = await api('/api/admin/tickets/bulk', {
      method: 'POST',
      cookie,
      json: {},
    });
    expect(res.status).toBe(422);
  });

  it('should process bulk update on happy path', async () => {
    const res = await api('/api/admin/tickets/bulk', {
      method: 'POST',
      cookie,
      json: { ids: ['ticket-1', 'ticket-2'], action: 'closeResolved' },
    });

    expect(res.status).toBe(200);
    // The `api()` helper returns `{ status, body, headers }` — use
    // `res.body` directly, not `res.json()` (which doesn't exist).
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('count');
  });
});
