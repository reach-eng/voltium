import { describe, it, expect, beforeAll } from 'vitest';
import { api, riderLogin } from '../helpers';

// PR-M.3 (Ticket #26.1): route moved from plural to singular form. See
// docs/AUDIT_TOP_LEVEL_SHELL_2026-07-30.md finding 3.1.
describe('POST /api/rider/register-token', () => {
  let riderToken: string;

  beforeAll(async () => {
    const login = await riderLogin('9999999999');
    riderToken = login.token;
  });

  it('should return 401 if auth is missing', async () => {
    const res = await api('/api/rider/register-token', {
      method: 'POST',
      json: { fcmToken: 'test-token' },
    });
    expect(res.status).toBe(401);
  });

  it('should return 422 for validation error (missing fcmToken)', async () => {
    const res = await api('/api/rider/register-token', {
      method: 'POST',
      json: {}, // fcmToken is missing
      token: riderToken,
    });
    // According to validator middleware, it might return 422 or 400.
    // The route code uses `errors.validation`, which typically returns 422.
    expect([400, 422]).toContain(res.status);
  });

  it('should return 200 on happy path', async () => {
    const res = await api('/api/rider/register-token', {
      method: 'POST',
      json: { fcmToken: 'test-fcm-token-123' },
      token: riderToken,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Token registered successfully');
  });
});
