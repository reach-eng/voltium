/**
 * TG (2026-08-05 legal/device audit) — P0-1: /api/rider/device/verify-lock
 * reads `lockPasswordHash` (the real Prisma column), not `lockPassword`.
 *
 * The old select returned `undefined` for every rider, so the
 * `!rider.lockPassword` guard was always true — locked riders could NEVER
 * unlock their admin-locked devices. This test pins the corrected field.
 */

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

vi.mock('@/lib/password', () => ({ verifyPassword: mocks.verifyPassword }));

vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));

vi.mock('@/lib/security-events', () => ({ logSecurityEvent: mocks.logSecurityEvent }));

vi.mock('@/lib/rate-limit-middleware', () => ({
  rateLimitIdentifierFromRequest: mocks.rateLimitIdentifierFromRequest,
}));

vi.mock('@/lib/db', () => ({
  db: { rider: { findUnique: mocks.findUnique } },
}));

import { POST } from '@/app/api/rider/device/verify-lock/route';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/rider/device/verify-lock', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('P0-1: verify-lock reads lockPasswordHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimitIdentifierFromRequest.mockReturnValue('ip:1.2.3.4');
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: 0 });
    mocks.requireRiderSession.mockResolvedValue({ riderDbId: 'rider_1', phone: '98xxxx' });
  });

  it('queries the lockPasswordHash column, not lockPassword', async () => {
    mocks.findUnique.mockResolvedValue({ lockPasswordHash: 'hashed-1234' });
    mocks.verifyPassword.mockResolvedValue({ valid: true });

    const res = await POST(makeRequest({ password: '1234' }));
    expect(res.status).toBe(200);

    const selectArg = mocks.findUnique.mock.calls[0][0];
    expect(selectArg.select).toHaveProperty('lockPasswordHash');
    expect(selectArg.select).not.toHaveProperty('lockPassword');
  });

  it('verifies the submitted password against the stored hash', async () => {
    mocks.findUnique.mockResolvedValue({ lockPasswordHash: 'hashed-1234' });
    mocks.verifyPassword.mockResolvedValue({ valid: true });

    const res = await POST(makeRequest({ password: '1234' }));
    expect(mocks.verifyPassword).toHaveBeenCalledWith('1234', 'hashed-1234');
    const json = await res.json();
    expect(json.data.success).toBe(true);
  });

  it('reports success:false when the rider has no configured lock hash', async () => {
    mocks.findUnique.mockResolvedValue({ lockPasswordHash: null });

    const res = await POST(makeRequest({ password: '1234' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(false);
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });

  it('reports incorrect password without leaking the hash', async () => {
    mocks.findUnique.mockResolvedValue({ lockPasswordHash: 'hashed-1234' });
    mocks.verifyPassword.mockResolvedValue({ valid: false });

    const res = await POST(makeRequest({ password: 'wrong' }));
    const json = await res.json();
    expect(json.data.success).toBe(false);
    expect(JSON.stringify(json)).not.toContain('hashed-1234');
  });
});
