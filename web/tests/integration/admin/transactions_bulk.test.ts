import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

/**
 * GET /api/admin/transactions/bulk
 * POST /api/admin/transactions/bulk
 */
describe('GET /api/admin/transactions/bulk', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
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
    adminCookie = (await adminLogin()).cookie;
  });

  it('1. returns 207 Multi-Status when an ID fails (P0-3 / TG-6)', async () => {
    const { status, body } = await api('/api/admin/transactions/bulk', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        ids: ['dummy-id-123'],
        action: 'approve',
      },
    });

    // P0-3: the old code returned 200 with a green toast over failures.
    // A failing ID now surfaces as 207 with an explicit failed count.
    expect(status).toBe(207);
    expect(body.success).toBe(true);
    expect(body.data.results).toBeDefined();
    expect(body.data.failed).toBe(1);
    expect(body.data.results[0].status).toBe('ERROR');
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

    expect([400, 405, 422]).toContain(status);
  });
});
