import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin, BASE_URL } from '../helpers';

let cookie: string;

describe('Server Health Checks Integration Tests', () => {
  beforeAll(async () => {
    // P1-5: every sub-route that exposes operational internals now
    // requires admin or cron auth. The tests authenticate as admin
    // first and additionally assert 401-without-auth on each
    // sub-route so a future regression that opens the surface is
    // caught.
    cookie = await adminLogin();
  });

  it('1. Main health check endpoint returns aggregate health status (admin)', async () => {
    const res = await api('/api/health?detailed=true', { cookie });

    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(res.body.status);
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database).toBeDefined();
    expect(res.body.checks.disk).toBeDefined();
    // P2-1: detailed mode exposes the version, public does not.
    expect(res.body.version).toBeDefined();
  }, 20000);

  it('2a. Public health check hides version, serviceMode, and outbox queueDepth', async () => {
    const res = await api('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.checks.database.latencyMs).toBeUndefined();
    expect(res.body.checks.disk.freeMB).toBeUndefined();
    // P2-1: anonymous callers must not see build fingerprinting or
    // operational internals.
    expect(res.body.version).toBeUndefined();
    expect(res.body.serviceMode).toBeUndefined();
    expect(res.body.checks.outbox).toBeDefined();
    expect(res.body.checks.outbox.queueDepth).toBeUndefined();
    expect(res.body.checks.outbox.status).toBeDefined();
  }, 20000);

  it('2b. Public VERSION field is the literal string "unknown" when no env var is set', async () => {
    // P2-2: package.json read at module init, falling back to
    // "unknown" if the file is unreadable. The integration
    // environment may set npm_package_version; either way the
    // response must be a real version string OR the literal
    // "unknown" — never the hardcoded "0.2.0".
    const res = await api('/api/health?detailed=true', { cookie });
    expect(typeof res.body.version).toBe('string');
    expect(res.body.version.length).toBeGreaterThan(0);
    expect(res.body.version).not.toBe('0.2.0');
  }, 20000);

  it('3. Database health endpoint requires admin auth (P1-5)', async () => {
    // Without cookie: 401.
    const noAuth = await api('/api/health/db');
    expect(noAuth.status).toBe(401);

    // With admin cookie: 200 or 503 depending on mock bypass.
    const res = await api('/api/health/db', { cookie });
    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  }, 20000);

  it('4. Storage health endpoint requires admin auth and is read-only (P1-2 + P1-5)', async () => {
    const noAuth = await api('/api/health/storage');
    expect(noAuth.status).toBe(401);

    const res = await api('/api/health/storage', { cookie });
    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
    expect(res.body.provider).toBe('local');
    expect(res.body.checks).toBeDefined();
  }, 20000);

  it('5. Worker health endpoint requires admin auth (P1-5)', async () => {
    const noAuth = await api('/api/health/worker');
    expect(noAuth.status).toBe(401);

    const res = await api('/api/health/worker', { cookie });
    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toBeDefined();
    expect(res.body.pending).toBeDefined();
  }, 20000);

  it('6. Health check outputs prevent database secrets or credentials leakage', async () => {
    const endpoints = [
      '/api/health?detailed=true',
      '/api/health',
      '/api/health/db',
      '/api/health/storage',
      '/api/health/worker',
    ];

    for (const path of endpoints) {
      const res = await api(path, { cookie });
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

// Touch BASE_URL to silence the unused-import warning on the rare
// build that doesn't have it in helpers.ts.
void BASE_URL;
