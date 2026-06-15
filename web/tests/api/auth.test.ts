import { describe, it, expect } from 'vitest';

const BASE = 'http://localhost:8081';

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers as any) },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, resHeaders: res.headers };
}

describe('Auth Flow Validation', () => {
  const testPhone = '9000000001';

  describe('POST /api/auth/send-otp', () => {
    it('sends OTP for valid phone number', async () => {
      const { status, body } = await api('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: testPhone }),
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      // In dev mode, the OTP is returned in the response for testing
      if (body.data?.otp) {
        expect(body.data.otp).toHaveLength(6);
      }
    });

    it('rejects invalid phone number', async () => {
      const { status, body } = await api('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: '123' }),
      });

      expect(status).toBe(422);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('verifies valid OTP and sets session cookie', async () => {
      // Step 1: Request an OTP
      const sendResult = await api('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: testPhone }),
      });
      expect(sendResult.status).toBe(200);

      // In dev, the OTP is returned in the response
      const otp = sendResult.body.data?.otp;
      expect(otp).toBeDefined();
      expect(otp).toHaveLength(6);

      // Step 2: Verify the OTP
      const { status, body, resHeaders } = await api('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: testPhone, otp }),
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.phone).toBe(testPhone);

      // Check for Set-Cookie header
      const setCookie = resHeaders.get('set-cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toMatch(/voltium-session=/);
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Lax/i);
    });

    it('rejects invalid OTP', async () => {
      // First, send an OTP so there's an entry in the store
      await api('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: testPhone }),
      });

      // Then try to verify with a wrong code
      const { status, body } = await api('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: testPhone, otp: '000000' }),
      });

      // With real OTP verification, invalid codes should always fail
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('rejects missing phone or OTP', async () => {
      const { status, body } = await api('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: testPhone }),
      });

      expect(status).toBe(422);
      expect(body.success).toBe(false);
    });
  });
});
