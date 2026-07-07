import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin, riderLogin, generateRandomPhone } from '../../helpers';

describe('POST /api/admin/riders/actions', () => {
  let adminCookie: string;
  let testRiderId: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
    
    // Create a real rider so we have a valid ID for testing
    const { riderId } = await riderLogin(generateRandomPhone());
    testRiderId = riderId;
  });

  it('should execute action successfully (ADMIN_LOCK) when valid data provided', async () => {
    const { status, body } = await api('/api/admin/riders/actions', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        riderId: testRiderId,
        action: 'ADMIN_LOCK',
      },
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('triggered successfully');
  });

  it('should return 401 Unauthorized if admin cookie is missing', async () => {
    const { status, body } = await api('/api/admin/riders/actions', {
      method: 'POST',
      json: {
        riderId: testRiderId,
        action: 'ADMIN_LOCK',
      },
    });

    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('should return 422 Unprocessable Entity if body is empty', async () => {
    const { status, body } = await api('/api/admin/riders/actions', {
      method: 'POST',
      cookie: adminCookie,
      json: {},
    });

    expect(status).toBe(422);
    expect(body.success).toBe(false);
  });
  
  it('should return 400 Bad Request for FCM-required actions if FCM token is missing', async () => {
    const { status, body } = await api('/api/admin/riders/actions', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        riderId: testRiderId,
        action: 'DISABLE_CAMERA',
      },
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('missing FCM token');
  });
});
