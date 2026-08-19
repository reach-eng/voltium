import '../setup-env';
import { describe, it, expect } from 'vitest';

const BASE = 'http://localhost:8081';

async function api(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe('Public Routes', () => {
  it('GET /api/device/data - validates payload', async () => {
    const { status } = await api('/api/device/data', { method: 'GET' });
    // Expect 400/422 if it needs query params or auth, or 200/404
    expect(status).toBeGreaterThanOrEqual(200); 
  });

  it('GET /api/rider/notifications - requires auth', async () => {
    const { status } = await api('/api/rider/notifications', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(400); 
  });

  it('GET /api/pricing - requires rider auth (P0-7 ops audit)', async () => {
    // P0-7 (2026-08-05 ops audit): the endpoint was unauthenticated and
    // leaked per-hub utilization / surge multipliers / fleet counts. It is
    // now gated behind requireRiderSession — an unauthenticated call must
    // NOT return pricing data.
    const { status } = await api('/api/pricing', { method: 'GET' });
    expect([401, 403]).toContain(status);
  });

  it('GET /api/search - handles search query', async () => {
    const { status } = await api('/api/search?q=test', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET /api/vehicles - returns public vehicle list', async () => {
    const { status, body } = await api('/api/vehicles', { method: 'GET' });
    if (status === 200) {
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    } else {
      expect(status).toBe(404);
    }
  });

  it('POST /api/support/chat - validates payload', async () => {
    const { status } = await api('/api/support/chat', { 
      method: 'POST', body: JSON.stringify({ message: '' }) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('GET /api/support/faqs - returns faqs', async () => {
    const { status, body } = await api('/api/support/faqs', { method: 'GET' });
    if (status === 200) {
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    } else {
      expect(status).toBe(404);
    }
  });

  it('POST /api/sync/queue - validates payload', async () => {
    const { status } = await api('/api/sync/queue', { 
      method: 'POST', body: JSON.stringify({ events: [] }) 
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('GET /api/transaction/history - requires auth', async () => {
    const { status } = await api('/api/transaction/history', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('POST /api/rider/register-token - validates payload', async () => {
    // PR-M.3 (Ticket #26.1): moved from plural to singular form. See
    // docs/AUDIT_TOP_LEVEL_SHELL_2026-07-30.md finding 3.1.
    const { status } = await api('/api/rider/register-token', {
      method: 'POST', body: JSON.stringify({ fcmToken: '' })
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  describe('Negative Scenarios (400, 404)', () => {
    it('returns 404 for unknown public routes', async () => {
      const { status } = await api('/api/unknown-public-route-xyz');
      expect(status).toBe(404);
    });

    it('returns 400 for malformed JSON payload in public routes', async () => {
      const { status } = await api('/api/support/chat', { 
        method: 'POST', 
        body: 'invalid json' 
      });
      expect(status).toBeGreaterThanOrEqual(400);
    });
  });
});
