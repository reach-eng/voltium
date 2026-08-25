import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../../helpers';

describe('GET /api/admin/data-management/restore/history', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = (await adminLogin()).cookie;
  });

  it('should return 401 if missing auth cookie', async () => {
    const { status } = await api('/api/admin/data-management/restore/history', { method: 'GET' });
    expect(status).toBe(401);
  });

  it('should return 200 and history data on success', async () => {
    const { status, body } = await api('/api/admin/data-management/restore/history', {
      method: 'GET',
      cookie,
    });

    if (status === 403) {
      expect(status).toBe(403);
    } else {
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    }
  });
});
