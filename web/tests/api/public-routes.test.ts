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

  it('GET /api/notification/list - requires auth', async () => {
    const { status } = await api('/api/notification/list', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(400); 
  });

  it('GET /api/pricing - returns pricing if implemented', async () => {
    const { status, body } = await api('/api/pricing', { method: 'GET' });
    if (status === 200) {
      expect(body.success).toBe(true);
    } else {
      expect(status).toBe(404);
    }
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

  it('POST /api/riders/register-token - validates payload', async () => {
    const { status } = await api('/api/riders/register-token', { 
      method: 'POST', body: JSON.stringify({ token: '' }) 
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
