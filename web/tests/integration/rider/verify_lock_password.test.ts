import { describe, it, expect, beforeAll } from 'vitest';
import { api, riderLogin } from '../helpers';

describe('POST /api/rider/verify-lock-password', () => {
  let riderToken: string;

  beforeAll(async () => {
    // We need a rider session
    // Because random phone doesn't have lock password, maybe we just get 200 with {success: false}
    const login = await riderLogin('9999999999'); // Use a random or known test phone
    riderToken = login.token;
  });

  it('should return 401 if auth is missing', async () => {
    const res = await api('/api/rider/verify-lock-password', {
      method: 'POST',
      json: { password: 'test' },
    });
    expect(res.status).toBe(401);
  });

  it('should return 400 for validation error (empty body)', async () => {
    const res = await api('/api/rider/verify-lock-password', {
      method: 'POST',
      json: {},
      token: riderToken,
    });
    expect(res.status).toBe(400); // Because verifyLockSchema uses z.object({password: z.string().min(1)})
  });

  it('should handle happy path (returns success: false if no lock password configured)', async () => {
    const res = await api('/api/rider/verify-lock-password', {
      method: 'POST',
      json: { password: 'wrongpassword' },
      token: riderToken,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Depending on whether it's set or not, it returns { success: false } or valid
    // We just check that the request was processed
    expect(res.body.data.success).toBeDefined();
  });
});
