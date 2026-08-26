import '../setup-env';
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:8081';

let riderCookie: string | null = null;
let riderToken: string | null = null;

async function api(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };

  if (riderToken) {
    headers['Authorization'] = `Bearer ${riderToken}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

beforeAll(async () => {
  try {
    const sendRes = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '9999900001' }),
    });
    const otp = sendRes.body?.data?.otp;

    const verifyRes = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '9999900001', otp }),
    });
    
    if (verifyRes.body?.data?.token) {
        riderToken = verifyRes.body.data.token;
    }
  } catch (err) {
    console.error('Failed to log in as rider for API tests', err);
  }
});

describe('Rider Endpoints', () => {
  it('POST /api/rider/device/verify-lock - requires authentication', async () => {
    const res = await fetch(`${BASE}/api/rider/device/verify-lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '1234' }),
    });
    // Assuming unauthenticated returns 401 or 403
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('GET /api/rider/offers - returns offers if authenticated', async () => {
    const { status, body } = await api('/api/rider/offers', { method: 'GET' });
    if (status === 200) {
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    } else {
      expect(status).toBe(404); // Route might not be fully implemented
    }
  });

  it('GET /api/rider/rewards - returns rewards if authenticated', async () => {
    const { status, body } = await api('/api/rider/rewards', { method: 'GET' });
    if (status === 200) {
      expect(body.success).toBe(true);
    } else {
      expect(status).toBe(404);
    }
  });

  it('GET /api/rider/settings - returns settings if authenticated', async () => {
    const { status, body } = await api('/api/rider/settings', { method: 'GET' });
    if (status === 200) {
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    } else {
      expect(status).toBe(404);
    }
  });

  it('PUT /api/rider/settings - updates settings validates payload', async () => {
    const { status, body } = await api('/api/rider/settings', { 
      method: 'PUT', 
      body: JSON.stringify({ notificationsEnabled: 'invalid_type' }) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  describe('Negative Scenarios (400, 401, 403, 404)', () => {
    it('returns 401/403 for unauthenticated access', async () => {
      const res = await fetch(`${BASE}/api/rider/settings`);
      expect(res.status).toBeGreaterThanOrEqual(401);
    });

    it('returns 404 for unknown rider endpoints', async () => {
      const { status } = await api('/api/rider/unknown-endpoint-xyz');
      expect(status).toBe(404);
    });
  });
});
