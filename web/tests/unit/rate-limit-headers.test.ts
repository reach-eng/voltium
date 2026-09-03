import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  clearRateLimitStore,
  getRateLimitHeaders,
  attachRateLimitHeaders,
  API_RATE_LIMIT,
} from '@/lib/rate-limit';
import {
  checkAndGetRateLimit,
  attachRateLimitHeaders as attachMiddlewareHeaders,
} from '@/lib/rate-limit-middleware';
import { NextResponse, NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/api-middleware';

describe('Rate Limit Headers Uniformity', () => {
  beforeEach(async () => {
    await clearRateLimitStore();
  });

  it('getRateLimitHeaders generates correct standard headers on allowed requests', async () => {
    const rl = await checkRateLimit('test-user-1', { maxRequests: 10, windowMs: 60000 });
    expect(rl.allowed).toBe(true);

    const headers = getRateLimitHeaders(rl, 10);
    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('9');
    expect(Number(headers['X-RateLimit-Reset'])).toBeGreaterThan(1700000000); // Unix timestamp in seconds
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('getRateLimitHeaders generates Retry-After and X-RateLimit-Remaining: 0 on throttled requests', async () => {
    const config = { maxRequests: 2, windowMs: 60000 };
    await checkRateLimit('test-user-2', config);
    await checkRateLimit('test-user-2', config);
    const blocked = await checkRateLimit('test-user-2', config);
    expect(blocked.allowed).toBe(false);

    const headers = getRateLimitHeaders(blocked, 2);
    expect(headers['X-RateLimit-Limit']).toBe('2');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
    expect(headers['Retry-After']).toBeDefined();
    expect(Number(headers['Retry-After'])).toBeGreaterThanOrEqual(1);
  });

  it('attachRateLimitHeaders attaches headers directly to NextResponse', async () => {
    const rl = await checkRateLimit('test-user-3', { maxRequests: 20, windowMs: 60000 });
    const res = NextResponse.json({ success: true });

    attachRateLimitHeaders(res, rl, 20);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('20');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('19');
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  it('withRateLimit middleware exposes X-RateLimit-* on successful response', async () => {
    const handler = async (_req: NextRequest) => NextResponse.json({ data: 'ok' });
    const wrapped = await withRateLimit(handler, 5, 60000);

    const req = new NextRequest('http://localhost:8081/api/test-route', {
      headers: { 'x-forwarded-for': '192.168.1.100' },
    });

    const res = await wrapped(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('4');
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  it('checkAndGetRateLimit middleware returns 429 with all X-RateLimit headers when blocked', async () => {
    const id = 'test-ip-blocked';
    const config = { maxRequests: 1, windowMs: 60000 };

    const first = await checkAndGetRateLimit(id, config);
    expect(first.allowed).toBe(true);

    const second = await checkAndGetRateLimit(id, config);
    expect(second.allowed).toBe(false);
    expect(second.response).toBeDefined();
    expect(second.response?.status).toBe(429);
    expect(second.response?.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(second.response?.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(second.response?.headers.get('Retry-After')).toBeDefined();
  });
});
