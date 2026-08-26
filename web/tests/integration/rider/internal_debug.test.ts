import { describe, it, expect } from 'vitest';
import { api } from '../helpers';

describe('GET /api/internal/debug', () => {
  const cronSecret = process.env.CRON_SECRET || 'test-cron-secret-change-me';

  it('should return 401 if auth is missing', async () => {
    const res = await api('/api/internal/debug', {
      method: 'GET',
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 if auth is invalid', async () => {
    const res = await api('/api/internal/debug', {
      method: 'GET',
      token: 'invalid-secret',
    });
    expect(res.status).toBe(401);
  });

  it('should return 200 and debug information on happy path', async () => {
    const res = await api('/api/internal/debug', {
      method: 'GET',
      token: cronSecret,
    });
    expect(res.status).toBe(200);
    // Since it returns direct JSON, we can check a few fields
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptimeSeconds).toBeDefined();
    expect(res.body.circuitBreakers).toBeDefined();
  });
});
