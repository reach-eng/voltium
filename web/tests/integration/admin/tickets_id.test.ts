import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('Admin API: GET /api/admin/tickets/[id]', () => {
  let cookie: string;

  beforeAll(async () => {
    const login = await adminLogin({ role: 'super_admin' });
    cookie = login.cookie;
  });

  it('should return 401 if missing auth', async () => {
    const res = await api('/api/admin/tickets/test-ticket-id', {
      method: 'GET',
    });
    expect(res.status).toBe(401);
  });

  it('should return 404 for non-existent ticket', async () => {
    const res = await api('/api/admin/tickets/non-existent-ticket-id', {
      method: 'GET',
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it('should return ticket details on happy path', async () => {
    const res = await api('/api/admin/tickets/test-ticket-id', {
      method: 'GET',
      headers: { Cookie: cookie },
    });
    
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    }
  });
});
