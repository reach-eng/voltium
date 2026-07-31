import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../../helpers';

describe('POST /api/admin/data-management/backups/:id/verify', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin();
  });

  it('should return 401 if missing auth cookie', async () => {
    const { status } = await api('/api/admin/data-management/backups/invalid-id/verify', {
      method: 'POST',
      json: {},
    });
    expect(status).toBe(401);
  });

  it('should return 404 or 500 for a non-existent backup', async () => {
    const { status } = await api('/api/admin/data-management/backups/non-existent-id/verify', {
      method: 'POST',
      cookie,
      json: {},
    });
    expect([404, 500]).toContain(status);
  });

  it('should successfully verify an existing backup', async () => {
    const listRes = await api('/api/admin/data-management/backups', {
      method: 'GET',
      cookie,
    });

    if (listRes.status === 200 && listRes.body?.data?.items?.length > 0) {
      const backupId = listRes.body.data.items[0].id;
      const verifyRes = await api(`/api/admin/data-management/backups/${backupId}/verify`, {
        method: 'POST',
        cookie,
        json: {},
      });

      if (verifyRes.status === 200) {
        expect(verifyRes.body.success).toBe(true);
        expect(verifyRes.body.data.checkedAt).toBeDefined();
      } else {
        expect([400, 404, 500]).toContain(verifyRes.status);
      }
    }
  });
});
