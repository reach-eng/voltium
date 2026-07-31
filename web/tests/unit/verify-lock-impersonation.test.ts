/**
 * Impersonation-block tests for /api/rider/device/verify-lock
 *
 * Tests that the route correctly rejects POST requests that carry the
 * `x-rider-id` header, even with a valid session. The header-based
 * impersonation path is gated to GET only at the framework level
 * (rider-auth.ts:33-34), but the route is explicit too — defense in depth.
 *
 * Audit ref: AUDIT_API_DEEP.md TOP #7, AUDIT_VERIFICATION_2026-07-29.md §1
 *
 * Pure unit tests of the route's impersonation guard — the actual
 * `requireRiderSession` call is mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock requireRiderSession to return a valid session when x-rider-id is absent,
// or throw a forbidden error when x-rider-id is present. The route should block
// x-rider-id BEFORE calling requireRiderSession, so the mock should never be
// invoked when the header is present.
const mockRequireRiderSession = vi.fn();
vi.mock('../../src/lib/rider-auth', () => ({
  requireRiderSession: (...args: unknown[]) => mockRequireRiderSession(...args),
}));

const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
vi.mock('../../src/lib/logger', () => ({ logger: mockLogger }));

const mockCheckRateLimit = vi.fn();
vi.mock('../../src/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

const mockLogSecurityEvent = vi.fn();
vi.mock('../../src/lib/security-events', () => ({
  logSecurityEvent: (...args: unknown[]) => mockLogSecurityEvent(...args),
}));

const mockDb = { rider: { findUnique: vi.fn() } };
vi.mock('../../src/lib/db', () => ({ db: mockDb }));

function mockRequest(headers: Record<string, string> = {}): any {
  const h = new Map(Object.entries(headers));
  return {
    headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null },
    json: async () => ({}),
  };
}

function mockResponse(): any {
  return { riderDbId: 'rider-123', phone: '+919999900000' };
}

describe('verify-lock — impersonation block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: requireRiderSession returns a valid session.
    mockRequireRiderSession.mockResolvedValue(mockResponse());
    // Default: rate limit allows.
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 5, resetAt: Date.now() + 60000 });
    // Default: rider has no lockPasswordHash.
    mockDb.rider.findUnique.mockResolvedValue(null);
  });

  async function getRoute() {
    return (await import('../../src/app/api/rider/device/verify-lock/route')).POST;
  }

  it('REJECTS POST with x-rider-id header (defense in depth)', async () => {
    const POST = await getRoute();
    const req = mockRequest({ 'x-rider-id': 'rider-target' });
    const res = await POST(req as any);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    // error is an object {code, message, ...}
    expect(body.error?.message || body.error).toMatch(/impersonation/i);
  });

  it('REJECTS POST with x-rider-id header even if requireRiderSession would succeed', async () => {
    mockRequireRiderSession.mockResolvedValue(mockResponse());
    const POST = await getRoute();
    const req = mockRequest({ 'x-rider-id': 'rider-target' });
    const res = await POST(req as any);

    // The route's own impersonation check fires BEFORE requireRiderSession.
    // So mockRequireRiderSession should NOT have been called.
    expect(mockRequireRiderSession).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });

  it('PROCEEDS to requireRiderSession on POST without x-rider-id header', async () => {
    const POST = await getRoute();
    const req = mockRequest({});
    req.json = async () => ({ password: 'test-pw' });
    const res = await POST(req as any);

    // Normal path proceeds: requireRiderSession is called FIRST.
    expect(mockRequireRiderSession).toHaveBeenCalled();
    // No lockPasswordHash set → success:true with data.success=false (legacy shape)
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data?.success).toBe(false);
  });

  it('returns 401 when no session is present and no x-rider-id', async () => {
    mockRequireRiderSession.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 })
    );
    const POST = await getRoute();
    const req = mockRequest({});
    req.json = async () => ({ password: 'test-pw' });
    const res = await POST(req as any);

    expect(res.status).toBe(401);
  });
});
