import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

/**
 * GET /api/admin/feature-flags — List all feature flags
 * PUT /api/admin/feature-flags — Update a feature flag
 *
 * Requires admin permission: settings_manage
 */
describe('GET /api/admin/feature-flags', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  it('1. returns 200 with all feature flags', async () => {
    const { status, body } = await api('/api/admin/feature-flags', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('2. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/feature-flags', { method: 'GET' });
    expect(status).toBe(401);
  });
});

describe('PUT /api/admin/feature-flags', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  it('1. updates a boolean feature flag', async () => {
    const { status, body } = await api('/api/admin/feature-flags', {
      method: 'PUT',
      cookie: adminCookie,
      json: { key: 'enableReferralSystem', value: 'true' },
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('2. updates a numeric feature flag', async () => {
    const { status, body } = await api('/api/admin/feature-flags', {
      method: 'PUT',
      cookie: adminCookie,
      json: { key: 'maxUploadSizeMb', value: '50' },
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('3. returns 400 when key is missing', async () => {
    const { status } = await api('/api/admin/feature-flags', {
      method: 'PUT',
      cookie: adminCookie,
      json: { value: 'true' },
    });
    expect([400, 405, 422]).toContain(status);
  });

  it('4. returns 400 when value is undefined', async () => {
    const { status } = await api('/api/admin/feature-flags', {
      method: 'PUT',
      cookie: adminCookie,
      json: { key: 'enableReferralSystem' },
    });
    expect([400, 405, 422]).toContain(status);
  });

  it('5. returns 400 for invalid key', async () => {
    const { status } = await api('/api/admin/feature-flags', {
      method: 'PUT',
      cookie: adminCookie,
      json: { key: 'invalidFeatureFlag', value: 'true' },
    });
    expect([400, 405, 422]).toContain(status);
  });

  it('6. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/feature-flags', {
      method: 'PUT',
      json: { key: 'enableReferralSystem', value: 'false' },
    });
    expect(status).toBe(401);
  });
});
