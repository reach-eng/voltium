import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('POST /api/admin/scores/recalculate', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  it('should return 401 if not authenticated', async () => {
    const { status, body } = await api('/api/admin/scores/recalculate', {
      method: 'POST',
    });
    
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('should recalculate scores successfully', async () => {
    const { status, body } = await api('/api/admin/scores/recalculate', {
      method: 'POST',
      cookie: adminCookie,
    });
    
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('successCount');
    expect(body.data).toHaveProperty('failureCount');
    expect(body.data).toHaveProperty('errors');
  });
});
