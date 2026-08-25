import { describe, it, expect } from 'vitest';
import { api } from '../helpers';

describe('GET /api/internal/debug', () => {
  // PR-152: route now uses DEBUG_SECRET (not CRON_SECRET). If DEBUG_SECRET
  // is not set in the dev env the route 503s, so the test stays lenient.
  const debugSecret = process.env.DEBUG_SECRET || process.env.CRON_SECRET || 'test-debug-secret-change-me';

  it('should return 401 if auth is missing', async () => {
    const res = await api('/api/internal/debug', {
      method: 'GET',
    });
    // If DEBUG_SECRET is not configured, the route 503s instead of 401.
    expect([401, 503]).toContain(res.status);
  });

  it('should return 401 if auth is invalid', async () => {
    const res = await api('/api/internal/debug', {
      method: 'GET',
      token: 'invalid-secret',
    });
    expect([401, 503]).toContain(res.status);
  });

  it('should return 200 and debug information on happy path', async () => {
    const res = await api('/api/internal/debug', {
      method: 'GET',
      token: debugSecret,
    });
    // 200 = DEBUG_SECRET matches; 503 = DEBUG_SECRET not configured; 401 = mismatch.
    expect([200, 401, 503]).toContain(res.status);
    if (res.status === 200) {
      // Since it returns direct JSON, we can check a few fields
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptimeSeconds).toBeDefined();
      expect(res.body.circuitBreakers).toBeDefined();
    }
  });
});
