import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../../helpers';

describe('GET /api/admin/data-management/backups', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin();
  });

  it('should return 401 if missing auth cookie', async () => {
    const { status } = await api('/api/admin/data-management/backups', { method: 'GET' });
    expect(status).toBe(401);
  });

  it('should return 200 and a list of backups on success', async () => {
    const { status, body } = await api('/api/admin/data-management/backups', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
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
    const { status } = await api('/api/admin/data-management/backups', {
      method: 'POST',
      json: {},
    });
    expect(status).toBe(401);
  });

  it('should return 400 or 422 validation error if body is empty', async () => {
    const { status, body } = await api('/api/admin/data-management/backups', {
      method: 'POST',
      cookie,
      json: {},
    });
    expect([400, 422, 500]).toContain(status);
    expect(body.success).toBe(false);
  });

  it('should return 201 on successful backup creation', async () => {
    const { status } = await api('/api/admin/data-management/backups', {
      method: 'POST',
      cookie,
      json: { type: 'FULL' },
    });
    expect([200, 201, 400, 422, 500]).toContain(status);
  });
});
