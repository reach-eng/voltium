/**
 * Ticket #51 — Rate limiter trusts cf-connecting-ip / x-forwarded-for
 *              unconditionally
 *
 * Audit claim: rate limiter uses proxy headers without validation,
 * letting clients spoof their IP and bypass rate limits.
 *
 * Verification: the rate-limiter code (`rate-limit-middleware.ts:77`)
 * only reads proxy headers when `env.TRUST_PROXY_HEADERS` is true.
 * The env schema defaults this to `false` and the serverless deploy
 * never sets it. So in default config, proxy headers are ignored.
 *
 * These tests lock in the spec:
 *   1. With TRUST_PROXY_HEADERS=false (default), proxy headers are
 *      ignored and rate-limit identifier falls back to Next.js's `ip`
 *      property (or 127.0.0.1 in unit-test environment).
 *   2. With TRUST_PROXY_HEADERS=true, the leftmost untrusted X-Forwarded-For
 *      IP is used.
 *   3. cf-connecting-ip takes priority over X-Forwarded-For when trusted.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('rate-limit-middleware identifier extraction (#51)', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  function makeRequest(headers: Record<string, string>, fakeIp?: string) {
    return {
      headers: {
        get: (key: string) => headers[key.toLowerCase()] ?? null,
      },
      // Fake Next.js request with .ip property (serverless-only)
      ip: fakeIp,
    } as any;
  }

  it('ignores proxy headers when TRUST_PROXY_HEADERS is not set (default false)', async () => {
    delete process.env.TRUST_PROXY_HEADERS;
    const { rateLimitIdentifierFromRequest } = await import('@/lib/rate-limit-middleware');
    const req = makeRequest(
      { 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '5.6.7.8' },
      '127.0.0.1' // Next.js .ip
    );
    const id = rateLimitIdentifierFromRequest(req);
    // Should NOT use the spoofed proxy headers — should use the Next.js ip
    expect(id).not.toMatch(/^ip:1\.2\.3\.4$/);
    expect(id).not.toMatch(/^ip:5\.6\.7\.8$/);
    expect(id).toMatch(/^ip:127\.0\.0\.1$/);
  });

  it('uses cf-connecting-ip when TRUST_PROXY_HEADERS is true', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    const { rateLimitIdentifierFromRequest } = await import('@/lib/rate-limit-middleware');
    const req = makeRequest({ 'cf-connecting-ip': '1.2.3.4' });
    const id = rateLimitIdentifierFromRequest(req);
    expect(id).toBe('ip:1.2.3.4');
  });

  it('parses X-Forwarded-For right-to-left, picking rightmost untrusted IP', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    // Default TRUSTED_PROXIES = '127.0.0.1,::1'
    // X-Forwarded-For format: client, proxy1, proxy2 (left=client, right=closest)
    // The code starts from the right and picks the first non-trusted IP —
    // i.e. the IP that the trusted proxy saw, which is the real client.
    const { rateLimitIdentifierFromRequest } = await import('@/lib/rate-limit-middleware');
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.1, 198.51.100.1, 127.0.0.1' });
    const id = rateLimitIdentifierFromRequest(req);
    // Should be 198.51.100.1 (rightmost untrusted IP, the one the trusted
    // proxy 127.0.0.1 saw — which is the real client when there's a single
    // hop after the trusted proxy)
    expect(id).toBe('ip:198.51.100.1');
  });

  it('uses leftmost untrusted IP when scanning all proxies', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    // Walking right-to-left: 127.0.0.1 trusted, ::1 trusted, 203.0.113.1
    // untrusted → result is 203.0.113.1 (the leftmost untrusted IP).
    const { rateLimitIdentifierFromRequest } = await import('@/lib/rate-limit-middleware');
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.1, ::1, 127.0.0.1' });
    const id = rateLimitIdentifierFromRequest(req);
    expect(id).toBe('ip:203.0.113.1');
  });

  it('cf-connecting-ip takes priority over x-forwarded-for when trusted', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    const { rateLimitIdentifierFromRequest } = await import('@/lib/rate-limit-middleware');
    const req = makeRequest({
      'cf-connecting-ip': '1.2.3.4',
      'x-forwarded-for': '5.6.7.8',
    });
    const id = rateLimitIdentifierFromRequest(req);
    expect(id).toBe('ip:1.2.3.4');
  });

  it('falls back to 127.0.0.1 when no IP source is available', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    const { rateLimitIdentifierFromRequest } = await import('@/lib/rate-limit-middleware');
    const req = makeRequest({});
    const id = rateLimitIdentifierFromRequest(req);
    expect(id).toMatch(/^ip:/);
    // Either 127.0.0.1 (fallback) or some Next.js default
    expect(id).toMatch(/^ip:(127\.0\.0\.1|::1|0\.0\.0\.0|unknown)$/);
  });
});
