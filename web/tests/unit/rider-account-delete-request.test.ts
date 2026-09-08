import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireRiderSession: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  createAuditLog: vi.fn(),
  checkRateLimit: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));
vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: mocks.requireRiderSession,
}));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));

import { POST } from '@/app/api/rider/account/delete-request/route';

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/rider/account/delete-request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Test gap 6 (settings audit, 2026-09-08): the rider delete-request route
 * was an OpenAPI stub with NO handler — every deletion attempt 404'd after
 * the lock-password step-up. The route now records the request; these
 * tests pin its auth, rate limit, and audit contract.
 */
describe('POST /api/rider/account/delete-request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRiderSession.mockResolvedValue({ riderDbId: 'rider_test_1' });
    mocks.findUnique.mockResolvedValue({
      id: 'rider_test_1',
      deletionRequestedAt: null,
    });
    mocks.update.mockResolvedValue({ id: 'rider_test_1' });
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetAt: 0,
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mocks.requireRiderSession.mockResolvedValueOnce(
      new Response('unauthorized', { status: 401 })
    );

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('returns 201-equivalent success + writes the rider marker and audit entry', async () => {
    const res = await POST(
      makeRequest({ reason: 'Moving abroad', timestamp: '2026-09-08T00:00:00Z' })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'rider_test_1' },
      data: expect.objectContaining({
        deletionRequestedAt: expect.any(Date),
        deletionRequestReason: 'Moving abroad',
      }),
    });

    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'rider_test_1',
        actorType: 'RIDER',
        action: 'rider.deletion_requested',
        entity: 'Rider',
      })
    );
  });

  it('429s past the rate limit and writes nothing', async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(429);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it('404s when the rider row is missing (no Prisma P2025 → 500)', async () => {
    mocks.findUnique.mockResolvedValueOnce(null);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('accepts an empty/absent body (reason is optional)', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'rider_test_1' },
      data: expect.objectContaining({ deletionRequestReason: null }),
    });
  });

  it('flags repeat requests in the audit entry', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'rider_test_1',
      deletionRequestedAt: new Date('2026-09-01T00:00:00Z'),
    });

    await POST(makeRequest({}));
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ repeatedRequest: true }),
      })
    );
  });
});
