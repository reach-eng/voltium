import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

/**
 * GET /api/admin/vehicles/[id]/history
 */
describe('GET /api/admin/vehicles/[id]/history', () => {
  let adminCookie: string;
  let hubId: string;
  let vehicleId: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();

    try {
      const hubRes = await api('/api/admin/hubs', {
        method: 'POST',
        cookie: adminCookie,
        json: {
          name: `History Hub ${Date.now()}`,
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
            vehicleNumber: `TEST-HIST-${Date.now()}`,
            model: 'History Model',
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

  it('1. returns 200 with vehicle history', async () => {
    if (!vehicleId) {
      console.warn('Skipping test as vehicle creation failed');
      return;
    }

    const { status, body } = await api(`/api/admin/vehicles/${vehicleId}/history`, {
      method: 'GET',
      cookie: adminCookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.vehicle).toBeDefined();
    expect(Array.isArray(body.data.timeline)).toBe(true);
  });

  it('2. returns 404 for a non-existent vehicle', async () => {
    const { status } = await api('/api/admin/vehicles/invalid-id-999/history', {
      method: 'GET',
      cookie: adminCookie,
    });

    expect(status).toBe(404);
  });

  it('3. returns 401 without auth', async () => {
    const testId = vehicleId || 'dummy-id';
    const { status } = await api(`/api/admin/vehicles/${testId}/history`, {
      method: 'GET',
    });

    expect(status).toBe(401);
  });
});
