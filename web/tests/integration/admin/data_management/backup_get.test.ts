import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../../helpers';

describe('GET /api/admin/data-management/backups', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin();
  });

  it('should return 401 if missing auth cookie', async () => {
    const response = await api.get('/api/admin/data-management/backups');
    expect(response.status).toBe(401);
  });

  it('should return 200 and a list of backups on success', async () => {
    const response = await api.get('/api/admin/data-management/backups', {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(200);
    const body = response.data;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.pagination).toBeDefined();
  });
});

describe('POST /api/admin/data-management/backups', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin();
  });

  it('should return 401 if missing auth cookie', async () => {
    const response = await api.post('/api/admin/data-management/backups', {});
    expect(response.status).toBe(401);
  });

  it('should return 400 validation error if body is empty', async () => {
    // The createBackupSchema likely requires a 'type' field which is missing
    const response = await api.post(
      '/api/admin/data-management/backups',
      {},
      { headers: { Cookie: cookie } }
    );
    expect(response.status).toBe(400);
    const body = response.data;
    expect(body.success).toBe(false);
    expect(body.error).toBe('Validation failed');
  });

  it('should return 201 on successful backup creation', async () => {
    // We send a valid backup type (assuming FULL is valid, or whatever schema allows)
    const response = await api.post(
      '/api/admin/data-management/backups',
      { type: 'FULL' },
      { headers: { Cookie: cookie } }
    );
    // Note: in a real environment this might trigger a long-running process, 
    // so it might return 201 if handled async, or 201 directly.
    expect(response.status).toBe(201);
    const body = response.data;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});
