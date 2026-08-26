import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin, riderLogin, generateRandomPhone } from '../../helpers';

describe('GET /api/admin/riders/[id]/device-data', () => {
  let adminCookie: string;
  let testRiderId: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
    
    // Create a real rider so we have a valid ID for testing
    const { riderId } = await riderLogin(generateRandomPhone());
    testRiderId = riderId;
  });

  it('should successfully fetch device data for the rider', async () => {
    const { status, body } = await api(`/api/admin/riders/${testRiderId}/device-data?type=all`, {
      method: 'GET',
      cookie: adminCookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('should return 401 Unauthorized if admin cookie is missing', async () => {
    const { status, body } = await api(`/api/admin/riders/${testRiderId}/device-data`, {
      method: 'GET',
    });

    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });
});
