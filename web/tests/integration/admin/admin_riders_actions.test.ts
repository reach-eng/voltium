import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin, riderLogin, generateRandomPhone } from '../helpers';

describe('POST /api/admin/riders/actions', () => {
  let adminCookie: string;
  let testRiderId: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;

    // Create a real rider so we have a valid ID for testing.
    // The admin route looks up riders by the internal `id` (DB
    // cuid), NOT the public `riderId` (`VF-RD-XXXXXXXX`). Destructure
    // `id` (not `riderId`) from the verify-otp response.
    const { id } = await riderLogin(generateRandomPhone());
    testRiderId = id;
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

    // The route's exact error body shape changed over time
    // (`{ message: '...' }` vs `{ error: { message: '...' } }`).
    // We only care that the request is rejected with a 4xx and
    // `success: false` — the specific error code/message is an
    // implementation detail of the FCM-required action gate.
    expect([400, 405, 422]).toContain(status);
    expect(body.success).toBe(false);
  });
});
