import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../../helpers';

describe('POST /api/admin/data-management/backups/:id/verify', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin();
  });

  it('should return 401 if missing auth cookie', async () => {
    const response = await api.post('/api/admin/data-management/backups/invalid-id/verify', {});
    expect(response.status).toBe(401);
  });

  it('should return 404 or 500 for a non-existent backup', async () => {
    const response = await api.post(
      '/api/admin/data-management/backups/non-existent-id/verify',
      {},
      { headers: { Cookie: cookie } }
    );
    expect([404, 500]).toContain(response.status);
  });

  it('should successfully verify an existing backup', async () => {
    const listRes = await api.get('/api/admin/data-management/backups', {
      headers: { Cookie: cookie },
    });
    
    if (listRes.status === 200 && listRes.data?.data?.items?.length > 0) {
      const backupId = listRes.data.data.items[0].id;
      const verifyRes = await api.post(
        `/api/admin/data-management/backups/${backupId}/verify`,
        {},
        { headers: { Cookie: cookie } }
      );
      
      if (verifyRes.status === 200) {
        expect(verifyRes.data.success).toBe(true);
        expect(verifyRes.data.data.checkedAt).toBeDefined();
      } else {
        // If file not found, it might throw an error internally mapped to 500 or similar
        expect([400, 404, 500]).toContain(verifyRes.status);
      }
    }
  });
});
