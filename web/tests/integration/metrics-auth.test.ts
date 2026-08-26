/**
 * 9.5+ Hardening (T-9P0-3) — metrics endpoint must not accept ?token=.
 *
 * Why this is in tests/integration (not tests/security/): the metrics
 * route is admin-only and runs through `requireAdmin()`. The dev
 * server has no INTERNAL_METRICS_TOKEN configured, so the only working
 * auth channel in CI/local is the admin session cookie. This test
 * verifies that path still works AND that a stray `?token=` query
 * parameter is rejected (the route now requires a header or admin
 * session, and a query-only request returns 401).
 *
 * For the `safeEqualSecret` constant-time behavior, see
 * tests/unit/safe-equal.test.ts (pure unit, no live server).
 */
import { describe, it, expect } from 'vitest';
import { adminLoginTo } from '../admin-auth-helper';

const BASE = 'http://localhost:8081';

async function api(
  path: string,
  options: RequestInit = {},
  cookieHeader: string | null = null,
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (cookieHeader) headers['Cookie'] = cookieHeader;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe('Security: /api/metrics ?token= rejection (9.5+ T-9P0-3)', () => {
  it('?token=anything with no header + no admin session is rejected', async () => {
    const r = await api('/api/metrics?token=anything');
    expect(r.status).toBe(401);
  });

  it('no credentials at all is rejected', async () => {
    const r = await api('/api/metrics');
    expect(r.status).toBe(401);
  });

  it('admin session still authenticates', async () => {
    const cookie = await adminLoginTo(BASE);
    const r = await api('/api/metrics?type=summary', {}, cookie);
    expect([200, 204]).toContain(r.status);
  });

  it('admin session + extraneous ?token= query is still allowed (token ignored, admin path wins)', async () => {
    const cookie = await adminLoginTo(BASE);
    const r = await api('/api/metrics?type=summary&token=irrelevant', {}, cookie);
    expect([200, 204]).toContain(r.status);
  });
});
