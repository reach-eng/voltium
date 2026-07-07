import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

/**
 * GET /api/admin/transactions/bulk
 * POST /api/admin/transactions/bulk
 */
describe('GET /api/admin/transactions/bulk', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
  });

  it('1. returns 200 on GET', async () => {
    const { status, body } = await api('/api/admin/transactions/bulk', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

describe('POST /api/admin/transactions/bulk', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
  });

  it('1. returns 200 for a valid request', async () => {
    const { status, body } = await api('/api/admin/transactions/bulk', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        ids: ['dummy-id-123'],
        action: 'approve',
      },
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.results).toBeDefined();
  });

  it('2. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/transactions/bulk', {
      method: 'POST',
      json: {
        ids: ['dummy-id-123'],
        action: 'approve',
      },
    });

    expect(status).toBe(401);
  });

  it('3. returns 400 when validation fails (empty body)', async () => {
    const { status } = await api('/api/admin/transactions/bulk', {
      method: 'POST',
      cookie: adminCookie,
      json: {},
    });

    expect(status).toBe(400);
  });
});
