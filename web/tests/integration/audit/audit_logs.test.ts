import { describe, it, expect } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('Audit Log Integration Tests', () => {
  it('allows SUPER_ADMIN to fetch audit logs with pagination', async () => {
    const cookie = await adminLogin();
    const { status, body } = await api('/api/admin/audit-logs?page=1&limit=5', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('allows filtering audit logs by actorId and action', async () => {
    const cookie = await adminLogin();
    const { status, body } = await api('/api/admin/audit-logs?actorId=admin-dev-id&action=LOGIN&limit=5', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('rejects audit log queries from unauthenticated clients', async () => {
    const { status } = await api('/api/admin/audit-logs', {
      method: 'GET',
    });

    expect(status).toBe(401);
  });

  it('ensures audit logs are immutable (no modification endpoints exist)', async () => {
    const cookie = await adminLogin();

    // Hitting POST on audit logs endpoint is not supported (should return 405 or 404)
    const postRes = await api('/api/admin/audit-logs', {
      method: 'POST',
      cookie,
      json: { actorId: 'hacker', action: 'fake' },
    });
    expect([404, 405]).toContain(postRes.status);

    // Hitting PUT on audit logs endpoint is not supported
    const putRes = await api('/api/admin/audit-logs', {
      method: 'PUT',
      cookie,
      json: { id: 'some-log-id', action: 'changed' },
    });
    expect([404, 405]).toContain(putRes.status);
  });

  it('allows running retention cleanup and retrieving stats', async () => {
    const cookie = await adminLogin();

    // GET stats
    const statsRes = await api('/api/admin/audit/cleanup', {
      method: 'GET',
      cookie,
    });
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.success).toBe(true);

    // POST to trigger cleanup
    const cleanupRes = await api('/api/admin/audit/cleanup', {
      method: 'POST',
      cookie,
    });
    expect(cleanupRes.status).toBe(200);
    expect(cleanupRes.body.success).toBe(true);
    expect(cleanupRes.body.data.deleted).toBeDefined();
  });
});
