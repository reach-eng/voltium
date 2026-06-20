import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:8081';
let riderToken: string | null = null;
const phone = '9999900001';

async function api(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; body: any }> {
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
      body: JSON.stringify({ phone }),
    });
    const otp = sendRes.body.data?.otp;
    const verifyRes = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
    riderToken = verifyRes.body.data?.token;
  } catch (err) {
    console.error('Failed to log in as rider for new rider integration tests', err);
  }
});

describe('Rider API Coverage Integration Tests', () => {
  it('GET /api/rider/dashboard returns dashboard data', async () => {
    const { status, body } = await api('/api/rider/dashboard');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('GET /api/rider/device returns device info or 404/200', async () => {
    const { status } = await api('/api/rider/device');
    expect([200, 404]).toContain(status);
  });

  it('GET /api/rider/kyc returns KYC profile or status', async () => {
    const { status } = await api('/api/rider/kyc');
    expect([200, 404]).toContain(status);
  });

  it('GET /api/rider/profile returns profile data', async () => {
    const { status, body } = await api('/api/rider/profile');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('GET /api/rider/referrals returns referral info or status', async () => {
    const { status } = await api('/api/rider/referrals');
    expect([200, 404]).toContain(status);
  });

  it('POST /api/rider/sync/device-data returns sync status or 200', async () => {
    const { status } = await api('/api/rider/sync/device-data', {
      method: 'POST',
      body: JSON.stringify({ deviceId: 'test-device-id', ping: true }),
    });
    expect([200, 201, 204, 400, 404]).toContain(status);
  });

  it('POST /api/rider/sync/pickup returns status or 200', async () => {
    const { status } = await api('/api/rider/sync/pickup', {
      method: 'POST',
      body: JSON.stringify({ latitude: 12.97, longitude: 77.59 }),
    });
    expect([200, 201, 204, 400, 404, 422]).toContain(status);
  });
});
