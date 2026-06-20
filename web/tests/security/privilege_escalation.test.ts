import { describe, it, expect } from 'vitest';
import { createSessionToken } from '../../src/lib/auth';

const BASE = 'http://localhost:8081';

async function api(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as any),
    },
    ...options,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe('Security: Privilege Escalation Audit', () => {
  const riderPayload = {
    riderId: 'AUDIT-RIDER-001',
    riderDbId: 'db-rider-001',
    phone: '9999900001',
    role: 'rider',
  };

  const riderToken = createSessionToken(riderPayload);

  it('rejects access to /api/admin/dashboard without token', async () => {
    const { status, body } = await api('/api/admin/dashboard');
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects access to /api/admin/dashboard with Rider Bearer token', async () => {
    const { status, body } = await api('/api/admin/dashboard', {
      headers: {
        Authorization: `Bearer ${riderToken}`,
      },
    });
    // Expected: 401 because getAdminSession only checks cookies
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects access to /api/admin/dashboard with Rider session cookie', async () => {
    const { status, body } = await api('/api/admin/dashboard', {
      headers: {
        Cookie: `voltium-session=${riderToken}`,
      },
    });
    // Expected: 401 because getAdminSession only checks voltium-admin-session cookie
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects access to /api/admin/riders with Rider Bearer token', async () => {
    const { status, body } = await api('/api/admin/riders', {
      headers: {
        Authorization: `Bearer ${riderToken}`,
      },
    });
    expect(status).toBe(401);
  });

  it('rejects access to /api/admin/transactions with Rider Bearer token', async () => {
    const { status, body } = await api('/api/admin/transactions', {
      headers: {
        Authorization: `Bearer ${riderToken}`,
      },
    });
    expect(status).toBe(401);
  });
});
