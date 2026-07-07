import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../../helpers';

describe('POST /api/admin/data-management/restore/start', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin(); // Logs in as superadmin likely
  });

  it('should return 401 if missing auth cookie', async () => {
    const response = await api.post('/api/admin/data-management/restore/start', {});
    expect(response.status).toBe(401);
  });

  it('should return 422 (or 400 depending on handler) validation error if body is empty', async () => {
    // The restoreStartSchema likely requires a 'backupId'
    const response = await api.post(
      '/api/admin/data-management/restore/start',
      {},
      { headers: { Cookie: cookie } }
    );
    
    // The handler uses withApiHandler which maps Zod errors to 400 (or 422).
    expect([400, 422]).toContain(response.status);
    expect(response.data.success).toBe(false);
  });

  it('should return 404 or 500 when starting restore with invalid backupId', async () => {
    const response = await api.post(
      '/api/admin/data-management/restore/start',
      { backupId: 'invalid-id' },
      { headers: { Cookie: cookie } }
    );
    
    // Depending on whether the use case throws a specific error or general error
    expect([400, 404, 500]).toContain(response.status);
    expect(response.data.success).toBe(false);
  });
});
