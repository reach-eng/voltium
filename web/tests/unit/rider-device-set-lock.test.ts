import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireRiderSession: vi.fn(),
  hashPassword: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
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
  hashPassword: mocks.hashPassword,
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
      update: mocks.update,
    },
  },
}));

import { POST } from '@/app/api/rider/device/set-lock/route';

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const req = new NextRequest('http://localhost/api/rider/device/set-lock', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return req;
}

describe('POST /api/rider/device/set-lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimitIdentifierFromRequest.mockReturnValue('ip:1.2.3.4');
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: 0 });
    mocks.requireRiderSession.mockResolvedValue({ riderDbId: 'rider_test_1', phone: '9876543210' });
    mocks.findUnique.mockResolvedValue({ id: 'rider_test_1' });
    mocks.hashPassword.mockResolvedValue('$argon2id$mock_hashed_pin');
    mocks.update.mockResolvedValue({ id: 'rider_test_1', lockPasswordHash: '$argon2id$mock_hashed_pin' });
  });

  it('rejects requests carrying the x-rider-id impersonation header with 403', async () => {
    const req = makeRequest({ password: '1234' }, { 'x-rider-id': 'rider_target' });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.message || body.error).toMatch(/impersonation/i);
    expect(mocks.requireRiderSession).not.toHaveBeenCalled();
  });

  it('returns 401 when rider session authentication fails', async () => {
    mocks.requireRiderSession.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 })
    );

    const req = makeRequest({ password: '1234' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 400 when request body contains invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/rider/device/set-lock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'invalid-json{',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 422 validation error when PIN is missing or invalid format', async () => {
    // Missing password
    let res = await POST(makeRequest({}));
    expect(res.status).toBe(422);

    // Non-numeric 4 chars
    res = await POST(makeRequest({ password: 'abcd' }));
    expect(res.status).toBe(422);

    // 3 digits
    res = await POST(makeRequest({ password: '123' }));
    expect(res.status).toBe(422);

    // 5 digits
    res = await POST(makeRequest({ password: '12345' }));
    expect(res.status).toBe(422);

    // Empty string
    res = await POST(makeRequest({ password: '' }));
    expect(res.status).toBe(422);
  });

  it('returns 429 and logs critical security event when rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await POST(makeRequest({ password: '5678' }));
    expect(res.status).toBe(429);

    expect(mocks.logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'rider.set_lock_password_rate_limit',
        severity: 'critical',
        actorId: 'rider_test_1',
        actorType: 'RIDER',
      })
    );
  });

  it('returns 404 when the rider cannot be found in the database', async () => {
    mocks.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ password: '5678' }));
    expect(res.status).toBe(404);
  });

  it('successfully updates lock password hash with Argon2id and logs security event', async () => {
    const res = await POST(makeRequest({ password: '5678' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ updated: true });

    expect(mocks.hashPassword).toHaveBeenCalledWith('5678');
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'rider_test_1' },
      data: { lockPasswordHash: '$argon2id$mock_hashed_pin' },
    });

    expect(mocks.logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'rider.set_lock_password',
        severity: 'info',
        actorId: 'rider_test_1',
        actorType: 'RIDER',
        details: { success: true },
      })
    );
  });

  it('returns 500 when database update throws an unexpected error', async () => {
    mocks.update.mockRejectedValue(new Error('DB connection dropped'));

    const res = await POST(makeRequest({ password: '5678' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
