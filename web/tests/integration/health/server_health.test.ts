import { describe, it, expect } from 'vitest';
import { api } from '../helpers';

describe('Server Health Checks Integration Tests', () => {
  it('1. Main health check endpoint returns aggregate health status', async () => {
    const res = await api('/api/health?detailed=true');

    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(res.body.status);
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database).toBeDefined();
    expect(res.body.checks.disk).toBeDefined();
  }, 20000);

  it('2. Main health check non-detailed hides internal check details', async () => {
    const res = await api('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.checks.database.latencyMs).toBeUndefined(); // Only status is returned
    expect(res.body.checks.disk.freeMB).toBeUndefined();
  }, 20000);

  it('3. Database health endpoint checks DB status', async () => {
    const res = await api('/api/health/db');

    // If database is offline, it might return 503 or 200 with healthy depending on mock bypass
    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  }, 20000);

  it('4. Storage health endpoint checks writable folders', async () => {
    const res = await api('/api/health/storage');

    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
    expect(res.body.provider).toBe('local');
    expect(res.body.checks).toBeDefined();
  }, 20000);

  it('5. Worker health endpoint checks outbox status', async () => {
    const res = await api('/api/health/worker');

    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toBeDefined();
    expect(res.body.pending).toBeDefined();
  }, 20000);

  it('6. Health check outputs prevent database secrets or credentials leakage', async () => {
    const endpoints = ['/api/health?detailed=true', '/api/health/db', '/api/health/storage', '/api/health/worker'];

    for (const path of endpoints) {
      const res = await api(path);
      const strBody = JSON.stringify(res.body);

      // Verify no sensitive keys or values are in the response
      expect(strBody.toLowerCase()).not.toContain('database_url');
      expect(strBody).not.toContain('postgresql://');
      expect(strBody).not.toContain('postgres://');
      expect(strBody.toLowerCase()).not.toContain('password');
      expect(strBody.toLowerCase()).not.toContain('secret');
    }
  }, 20000);
});
