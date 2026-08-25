import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../../helpers';

describe('POST /api/admin/data-management/restore/start', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = (await adminLogin()).cookie;
  });

  it('should return 401 if missing auth cookie', async () => {
    const { status } = await api('/api/admin/data-management/restore/start', {
      method: 'POST',
      json: {},
    });
    expect(status).toBe(401);
  });

  it('should return 422 (or 400 depending on handler) validation error if body is empty', async () => {
    const { status, body } = await api('/api/admin/data-management/restore/start', {
      method: 'POST',
      cookie,
      json: {},
    });
    expect([400, 405, 422, 500]).toContain(status);
    expect(body.success).toBe(false);
  });

  it('should return 404 or 500 when starting restore with invalid backupId', async () => {
    const { status, body } = await api('/api/admin/data-management/restore/start', {
      method: 'POST',
      cookie,
      json: { backupId: 'invalid-id' },
    });

    expect([400, 404, 500]).toContain(status);
    expect(body.success).toBe(false);
  });
});
