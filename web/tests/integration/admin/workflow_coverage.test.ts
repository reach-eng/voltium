import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('Admin API: /api/admin/workflow-coverage', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin();
  });

  it('GET /api/admin/workflow-coverage - happy path', async () => {
    const { status, body } = await api('/api/admin/workflow-coverage', {
      method: 'GET',
      cookie,
    });
    
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('workflows');
    expect(body.data).toHaveProperty('database');
    expect(body.data).toHaveProperty('workers');
    expect(body.data).toHaveProperty('timestamp');
  });

  it('GET /api/admin/workflow-coverage - unauthenticated', async () => {
    const { status, body } = await api('/api/admin/workflow-coverage', {
      method: 'GET',
    });
    
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });
});
