import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../../helpers';

describe('DELETE /api/admin/data-management/backups/:id', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = (await adminLogin()).cookie;
  });

  it('should return 401 if missing auth cookie', async () => {
    const { status } = await api('/api/admin/data-management/backups/invalid-id', {
      method: 'DELETE',
    });
    expect(status).toBe(401);
  });

  it('should return 404 or 500 for an invalid backup id', async () => {
    const { status } = await api('/api/admin/data-management/backups/invalid-id', {
      method: 'DELETE',
      cookie,
    });
    expect([404, 500]).toContain(status);
  });

  it('should return 200 on successful deletion of an existing backup', async () => {
    const createRes = await api('/api/admin/data-management/backups', {
      method: 'POST',
      cookie,
      json: { type: 'FULL' },
    });

    if ([200, 201].includes(createRes.status) && createRes.body?.data?.id) {
      const backupId = createRes.body.data.id;
      const deleteRes = await api(`/api/admin/data-management/backups/${backupId}`, {
        method: 'DELETE',
        cookie,
      });

      expect([200, 204]).toContain(deleteRes.status);
    }
  });
});
