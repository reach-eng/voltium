import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireRiderSession: vi.fn(),
  verifyPassword: vi.fn(),
  findUnique: vi.fn(),
  checkRateLimit: vi.fn(),
  logSecurityEvent: vi.fn(),
  rateLimitIdentifierFromRequest: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: mocks.requireRiderSession,
}));

vi.mock('@/lib/password', () => ({
  verifyPassword: mocks.verifyPassword,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock('@/lib/security-events', () => ({
  logSecurityEvent: mocks.logSecurityEvent,
}));

vi.mock('@/lib/rate-limit-middleware', () => ({
  rateLimitIdentifierFromRequest: mocks.rateLimitIdentifierFromRequest,
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.findUnique,
    },
  },
}));

import { POST } from '@/app/api/rider/device/verify-lock/route';

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const req = new NextRequest('http://localhost/api/rider/device/verify-lock', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return req;
}

const SESSION = { riderDbId: 'rider-1', role: 'rider' as const };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRiderSession.mockResolvedValue(SESSION);
  mocks.rateLimitIdentifierFromRequest.mockReturnValue('ip:127.0.0.1');
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: 0 });
  mocks.findUnique.mockResolvedValue({ lockPasswordHash: '$2b$10$fakehash' });
  mocks.verifyPassword.mockResolvedValue({ valid: false });
});

describe('POST /api/rider/device/verify-lock — P3-5 PIN schema', () => {
  it('rejects a 5-digit PIN with 422', async () => {
    const req = makeRequest({ password: '12345' });
    const res = await POST(req);

    // The standard `errors.validation()` helper returns 422 (not 400)
    // — same as the existing set-lock route, so the test mirrors the
    // project-wide convention for Zod validation failures.
    expect(res.status).toBe(422);
    // The bcrypt compare must NOT have run for malformed input.
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    // The DB must NOT have been touched.
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an alphabetic password with 422', async () => {
    const req = makeRequest({ password: 'abcd' });
    const res = await POST(req);

    expect(res.status).toBe(422);
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('accepts a 4-digit PIN and proceeds to bcrypt', async () => {
    mocks.verifyPassword.mockResolvedValue({ valid: true });

    const req = makeRequest({ password: '1234' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
    expect(mocks.verifyPassword).toHaveBeenCalledWith('1234', '$2b$10$fakehash');
    const body = await res.json();
    expect(body.data).toMatchObject({ success: true });
  });

  it('returns success: false when the bcrypt compare says invalid', async () => {
    mocks.verifyPassword.mockResolvedValue({ valid: false });

    const req = makeRequest({ password: '1234' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({ success: false });
  });

  it('rejects when no lock is configured on the rider (P0-1 regression guard)', async () => {
    mocks.findUnique.mockResolvedValue({ lockPasswordHash: null });

    const req = makeRequest({ password: '1234' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({ success: false });
    // We deliberately skip bcrypt when no lock is configured.
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });
});
