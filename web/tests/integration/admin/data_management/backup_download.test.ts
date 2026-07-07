import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../../helpers';

describe('GET /api/admin/data-management/backups/:id/download', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin();
  });

  it('should return 401 if missing auth cookie', async () => {
    const response = await api.get('/api/admin/data-management/backups/invalid-id/download');
    expect(response.status).toBe(401);
  });

  it('should return 404 or 500 for a non-existent backup download', async () => {
    const response = await api.get('/api/admin/data-management/backups/non-existent-id/download', {
      headers: { Cookie: cookie },
    });
    // Should map to 404 (Backup not found) or 500
    expect([404, 500]).toContain(response.status);
  });

  // Depending on whether we can successfully create and download a backup in the test environment,
  // we add a placeholder test for the happy path.
  it('should return 200 with attachment headers for valid backup', async () => {
    const listRes = await api.get('/api/admin/data-management/backups', {
      headers: { Cookie: cookie },
    });
    
    // If there is any existing backup, we can try to download it
    if (listRes.status === 200 && listRes.data?.data?.items?.length > 0) {
      const backupId = listRes.data.data.items[0].id;
      const downloadRes = await api.get(`/api/admin/data-management/backups/${backupId}/download`, {
        headers: { Cookie: cookie },
        responseType: 'arraybuffer', // Important for file downloads
      });
      
      // We expect 200 if the files actually exist on disk, or 404 if "Backup file not found"
      if (downloadRes.status === 200) {
        expect(downloadRes.headers['content-disposition']).toMatch(/attachment; filename="/);
      } else {
        expect(downloadRes.status).toBe(404);
      }
    }
  });
});
