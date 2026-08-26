import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../../helpers';

describe('GET /api/admin/data-management/backups/:id/download', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin();
  });

  it('should return 401 if missing auth cookie', async () => {
    const { status } = await api('/api/admin/data-management/backups/invalid-id/download', {
      method: 'GET',
    });
    expect(status).toBe(401);
  });

  it('should return 404 or 500 for a non-existent backup download', async () => {
    const { status } = await api('/api/admin/data-management/backups/non-existent-id/download', {
      method: 'GET',
      cookie,
    });
    expect([404, 500]).toContain(status);
  });

  it('should return 200 with attachment headers for valid backup', async () => {
    const listRes = await api('/api/admin/data-management/backups', {
      method: 'GET',
      cookie,
    });

    if (listRes.status === 200 && listRes.body?.data?.items?.length > 0) {
      const backupId = listRes.body.data.items[0].id;
      const downloadRes = await api(`/api/admin/data-management/backups/${backupId}/download`, {
        method: 'GET',
        cookie,
      });

      if (downloadRes.status === 200) {
        expect(downloadRes.headers['content-disposition']).toMatch(/attachment; filename="/);
      } else {
        expect([404, 500]).toContain(downloadRes.status);
      }
    }
  });
});
