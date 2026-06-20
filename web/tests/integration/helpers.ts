import { expect } from 'vitest';

export const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8081';

export interface RequestOptions extends RequestInit {
  json?: any;
  token?: string;
  cookie?: string;
}

/**
 * Standard API request helper for integration tests
 */
export async function api(
  path: string,
  options: RequestOptions = {}
): Promise<{ status: number; body: any; headers: Headers }> {
  const headers = new Headers(options.headers);

  if (options.json) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.json);
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  if (options.cookie) {
    headers.set('Cookie', options.cookie);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let body = null;
  const text = await res.text();
  try {
    if (text) body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: res.status, body, headers: res.headers };
}

/**
 * Admin login helper: returns the session cookie
 */
export async function adminLogin(): Promise<string> {
  const { status, body, headers } = await api('/api/admin/auth/auto-login', {
    method: 'POST',
    json: {},
  });

  expect(status).toBe(200);
  expect(body.success).toBe(true);

  const setCookie = headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No set-cookie header in admin login response');
  }

  // Parse the cookie to keep only the token cookie part
  return setCookie.split(';')[0];
}

/**
 * Rider login helper: performs send-otp -> verify-otp and returns the token
 */
export async function riderLogin(
  phone: string
): Promise<{ token: string; id: string; riderId: string }> {
  // 1. Send OTP
  const sendRes = await api('/api/auth/send-otp', {
    method: 'POST',
    json: { phone },
  });

  expect(sendRes.status).toBe(200);
  expect(sendRes.body.success).toBe(true);
  const otp = sendRes.body.data?.otp || '123456';

  // 2. Verify OTP
  const verifyRes = await api('/api/auth/verify-otp', {
    method: 'POST',
    json: { phone, otp },
  });

  expect(verifyRes.status).toBe(200);
  expect(verifyRes.body.success).toBe(true);

  const { token, id, riderId } = verifyRes.body.data || {};
  if (!token) {
    throw new Error('Rider login failed: no token returned');
  }

  return { token, id, riderId };
}

/**
 * Generates a random valid Indian phone number (10 digits starting with 7, 8 or 9)
 */
export function generateRandomPhone(): string {
  const prefix = ['7', '8', '9'][Math.floor(Math.random() * 3)];
  let rest = '';
  for (let i = 0; i < 9; i++) {
    rest += Math.floor(Math.random() * 10);
  }
  return prefix + rest;
}
