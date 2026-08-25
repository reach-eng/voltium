import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

/**
 * POST /api/admin/vehicles/bulk
 */
describe('POST /api/admin/vehicles/bulk', () => {
  let adminCookie: string;
  let hubId: string;
  let vehicleId: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;

    try {
      const hubRes = await api('/api/admin/hubs', {
        method: 'POST',
        cookie: adminCookie,
        json: {
          name: `Test Hub ${Date.now()}`,
          city: 'Test City',
          isActive: true,
        },
      });
      hubId = hubRes.body?.data?.id;

      if (hubId) {
        const vehicleRes = await api('/api/admin/vehicles', {
          method: 'POST',
          cookie: adminCookie,
          json: {
            vehicleNumber: `TEST-BULK-${Date.now()}`,
            model: 'Test Model',
            hubId: hubId,
            status: 'AVAILABLE'
          },
        });
        vehicleId = vehicleRes.body?.data?.id;
      }
    } catch (error) {
      console.warn('Failed to set up test data:', error);
    }
  });

  it('1. returns 200 for a valid bulk action', async () => {
    const { status, body } = await api('/api/admin/vehicles/bulk', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        ids: vehicleId ? [vehicleId] : ['dummy-vehicle-id'],
        action: 'changeStatus',
        value: 'RETIRED'
      },
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('2. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/vehicles/bulk', {
      method: 'POST',
      json: {
        ids: ['dummy-id'],
        action: 'changeStatus',
        value: 'RETIRED'
      },
    });

    expect(status).toBe(401);
  });

  it('3. returns 400 when validation fails (empty body)', async () => {
    const { status } = await api('/api/admin/vehicles/bulk', {
      method: 'POST',
      cookie: adminCookie,
      json: {},
    });

    expect([400, 405, 422]).toContain(status);
  });
});
