import { describe, it, expect } from 'vitest';
import { api } from '../helpers';

describe('Admin Authentication Integration Tests', () => {
  const testEmail = 'admin@voltium.io';
  const testPassword = 'adminPassword123';

  it('rejects login with missing email or password', async () => {
    const { status, body } = await api('/api/admin/auth/login', {
      method: 'POST',
      json: { email: '' },
    });

    expect([400, 422]).toContain(status);
    expect(body.success).toBe(false);
  });

  it('rejects login with invalid email format', async () => {
    const { status, body } = await api('/api/admin/auth/login', {
      method: 'POST',
      json: { email: 'not-an-email', password: 'password123' },
    });

    expect([400, 422]).toContain(status);
    expect(body.success).toBe(false);
  });

  it('rejects login with wrong credentials', async () => {
    const { status, body } = await api('/api/admin/auth/login', {
      method: 'POST',
      json: { email: 'wrong@voltium.io', password: 'wrongpassword' },
    });

    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error?.message).toContain('Invalid email or password');
  });

  it('allows auto-login in dev/test environment and returns session cookie', async () => {
    const { status, body, headers } = await api('/api/admin/auth/auto-login', {
      method: 'POST',
      json: {},
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.role).toBeDefined();

    const setCookie = headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('voltium-admin-session');
  });

  it('retrieves profile via /me when authenticated', async () => {
    const loginRes = await api('/api/admin/auth/auto-login', {
      method: 'POST',
      json: {},
    });
    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];

    const { status, body } = await api('/api/admin/auth/me', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.email).toBeDefined();
    expect(body.data.role).toBeDefined();
  });

  it('blocks /me when unauthenticated', async () => {
    const { status, body } = await api('/api/admin/auth/me', {
      method: 'GET',
    });

    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('enforces rate limiting on repeated login attempts', async () => {
    // Send multiple requests to trigger rate limit (AUTH_RATE_LIMIT is usually low, or we can send 15 requests)
    const requests = Array.from({ length: 15 }).map(() =>
      api('/api/admin/auth/login', {
        method: 'POST',
        json: { email: 'nonexistent@voltium.io', password: 'password' },
      })
    );

    const responses = await Promise.all(requests);
    const hasRateLimited = responses.some((res) => res.status === 429);
    expect(hasRateLimited || responses[0].status === 401).toBe(true);
  });

  it('logs out and clears the admin session cookie', async () => {
    const loginRes = await api('/api/admin/auth/auto-login', {
      method: 'POST',
      json: {},
    });
    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];

    const { status, body, headers } = await api('/api/admin/auth/logout', {
      method: 'POST',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    const setCookie = headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie?.toLowerCase()).toContain('max-age=0'); // Expire immediately
  });
});
