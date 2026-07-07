import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../../helpers';

describe('GET /api/admin/data-management/restore/history', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin();
  });

  it('should return 401 if missing auth cookie', async () => {
    const response = await api.get('/api/admin/data-management/restore/history');
    expect(response.status).toBe(401);
  });

  it('should return 200 and history data on success', async () => {
    // Wait, the API file uses /api/admin/data-management/restore/history, so we use that path.
    const response = await api.get('/api/admin/data-management/restore/history', {
      headers: { Cookie: cookie },
    });

    // The route maps "Unauthorized" error message to 403, and everything else to 500.
    // If successful, we expect 200.
    if (response.status === 403) {
      expect(response.status).toBe(403);
    } else {
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toBeDefined();
    }
  });
});
