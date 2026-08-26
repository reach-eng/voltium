import '../setup-env';
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:8081';

let adminCookie: string | null = null;

async function api(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };

  if (adminCookie) {
    headers['Cookie'] = adminCookie;
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
    const res = await fetch(`${BASE}/api/admin/auth/auto-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      adminCookie = setCookie;
    }
  } catch (err) {
    console.error('Failed to log in as admin for API tests', err);
  }
});

describe('Admin Mutations', () => {
  // --- Admins ---
  it('POST /api/admin/admins - rejects unauthenticated requests', async () => {
    const res = await fetch(`${BASE}/api/admin/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
  
  it('GET /api/admin/admins - lists admins if authenticated', async () => {
    const { status, body } = await api('/api/admin/admins', { method: 'GET' });
    if (status === 200) {
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    } else {
      expect(status).toBe(404);
    }
  });

  it('DELETE /api/admin/admins - rejects missing id', async () => {
    const { status, body } = await api('/api/admin/admins', { method: 'DELETE' });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // --- Announcements ---
  it('POST /api/admin/announcements - validates payload', async () => {
    const { status } = await api('/api/admin/announcements', { 
      method: 'POST',
      body: JSON.stringify({}) // empty body should fail validation
    });
    expect(status).toBe(422); // Validation error
  });

  it('PUT /api/admin/announcements - validates payload', async () => {
    const { status } = await api('/api/admin/announcements', { 
      method: 'PUT',
      body: JSON.stringify({ id: 'fake' })
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('DELETE /api/admin/announcements - rejects missing id', async () => {
    const { status } = await api('/api/admin/announcements', { method: 'DELETE' });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // --- Coupons ---
  it('POST /api/admin/coupons - validates payload', async () => {
    const { status } = await api('/api/admin/coupons', { 
      method: 'POST', body: JSON.stringify({ code: '' }) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // --- Hubs ---
  it('POST /api/admin/hubs - validates payload', async () => {
    const { status } = await api('/api/admin/hubs', { 
      method: 'POST', body: JSON.stringify({ name: '' }) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('PUT /api/admin/hubs - validates payload', async () => {
    const { status } = await api('/api/admin/hubs', { 
      method: 'PUT', body: JSON.stringify({ id: 'fake' }) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('DELETE /api/admin/hubs - rejects missing id', async () => {
    const { status } = await api('/api/admin/hubs', { method: 'DELETE' });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // --- Plans ---
  it('POST /api/admin/plans - validates payload', async () => {
    const { status } = await api('/api/admin/plans', { 
      method: 'POST', body: JSON.stringify({ name: '' }) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('PUT /api/admin/plans - validates payload', async () => {
    const { status } = await api('/api/admin/plans', { 
      method: 'PUT', body: JSON.stringify({ id: 'fake' }) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('DELETE /api/admin/plans - rejects missing id', async () => {
    const { status } = await api('/api/admin/plans', { method: 'DELETE' });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // --- Riders ---
  it('PUT /api/admin/riders/[id] - updates rider validates payload', async () => {
    const { status } = await api('/api/admin/riders/fake-id', { 
      method: 'PUT', body: JSON.stringify({ accountStatus: 'INVALID' }) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('POST /api/admin/riders/bulk - bulk rider actions validates payload', async () => {
    const { status } = await api('/api/admin/riders/bulk', { 
      method: 'POST', body: JSON.stringify({ action: 'UNKNOWN', riderIds: [] }) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // --- Settings ---
  it('PUT /api/admin/settings - updates settings validates payload', async () => {
    const { status } = await api('/api/admin/settings', { 
      method: 'PUT', body: JSON.stringify({}) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // --- Shifts ---
  it('POST /api/admin/shifts - validates payload', async () => {
    const { status } = await api('/api/admin/shifts', { 
      method: 'POST', body: JSON.stringify({}) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('PUT /api/admin/shifts - validates payload', async () => {
    const { status } = await api('/api/admin/shifts', { 
      method: 'PUT', body: JSON.stringify({ id: 'fake' }) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // --- Team Leaders ---
  it('POST /api/admin/team-leaders - validates payload', async () => {
    const { status } = await api('/api/admin/team-leaders', { 
      method: 'POST', body: JSON.stringify({}) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // --- Vehicles ---
  it('POST /api/admin/vehicles - validates payload', async () => {
    const { status } = await api('/api/admin/vehicles', { 
      method: 'POST', body: JSON.stringify({}) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('PUT /api/admin/vehicles/[id] - validates payload', async () => {
    const { status } = await api('/api/admin/vehicles/fake-id', { 
      method: 'PUT', body: JSON.stringify({}) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });
});
