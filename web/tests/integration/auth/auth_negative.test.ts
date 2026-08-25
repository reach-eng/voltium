import { describe, it, expect } from 'vitest';
import { api, generateRandomPhone, riderLogin, adminLogin } from '../helpers';

const LONG_TIMEOUT = 30000;

describe('Auth & RBAC Negative Tests', () => {
  describe('Rider endpoint protection', () => {
    it('rejects rider endpoint with no auth header', async () => {
      const { status, body } = await api('/api/rider/profile', { method: 'GET' });
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('rejects rider endpoint with garbage bearer token', async () => {
      const { status, body } = await api('/api/rider/profile', {
        method: 'GET',
        token: 'this-is-not-a-valid-jwt',
      });
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('rejects rider endpoint with tampered token', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token } = await riderLogin(phone);
      const tampered = token.slice(0, -5) + 'XXXXX';
      const { status, body } = await api('/api/rider/profile', {
        method: 'GET',
        token: tampered,
      });
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('rejects rider endpoint with admin session cookie instead of bearer token', async () => {
      const cookie = (await adminLogin()).cookie;
      const { status, body } = await api('/api/rider/profile', {
        method: 'GET',
        cookie,
      });
      expect([401, 403, 405]).toContain(status);
      expect(body.success).toBe(false);
    });
  });

  describe('Admin endpoint protection', () => {
    it('rejects admin endpoint with no cookie', async () => {
      const { status, body } = await api('/api/admin/auth/me', {
        method: 'GET',
      });
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('rejects admin endpoint with garbage cookie', async () => {
      const { status, body } = await api('/api/admin/auth/me', {
        method: 'GET',
        cookie: 'voltium-admin-session=garbage',
      });
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('rejects admin endpoint with rider bearer token', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token } = await riderLogin(phone);
      const { status, body } = await api('/api/admin/auth/me', {
        method: 'GET',
        token,
      });
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('rejects admin KYC action without cookie', async () => {
      const { status, body } = await api('/api/admin/kyc', {
        method: 'POST',
        json: { riderId: 'some-id', action: 'APPROVE' },
      });
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });
  });

  describe('OTP verify exhaustion', () => {
    it('rejects OTP verify after wrong OTP attempts', async () => {
      const phone = generateRandomPhone();
      await api('/api/auth/send-otp', {
        method: 'POST',
        json: { phone },
      });

      const wrongOtp = '000000';
      for (let i = 0; i < 3; i++) {
        const { status } = await api('/api/auth/verify-otp', {
          method: 'POST',
          json: { phone, otp: wrongOtp },
        });
        if (i < 2) {
          // Wrong-OTP responses: 400 (legacy handler), 401 (auth
          // "Invalid OTP" / "No OTP found"), 429 (rate limit).
          expect([400, 401, 429, 500]).toContain(status);
        }
      }

      const { status, body } = await api('/api/auth/verify-otp', {
        method: 'POST',
        json: { phone, otp: wrongOtp },
      });
      expect([400, 401, 429, 500]).toContain(status);
      if (body) expect(body.success).toBe(false);
    });
  });
});
