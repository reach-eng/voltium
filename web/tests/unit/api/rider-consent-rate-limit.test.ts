import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// LEGAL-AUDIT-P1-4-2026-09-08: POST /api/rider/consent had no per-rider
// rate limit. The Flutter rider's _handleContinue now fires 6 unawaited
// POSTs (one per legal type) on a single wall accept — without a cap, a
// loop appends Consent rows unboundedly and the GET `take: 100` silently
// truncates history. This test pins the 10/min per-rider cap at the
// route boundary.

const requireRiderSessionMock = vi.fn();
const checkRateLimitMock = vi.fn();
const dbConsentCreateMock = vi.fn();

vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: (...args: unknown[]) => requireRiderSessionMock(...args),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));
vi.mock('@/lib/db', () => ({
  db: {
    consent: {
      create: (...args: unknown[]) => dbConsentCreateMock(...args),
    },
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
// The route validates body with the real consentSchema; for this test we
// only need a passing payload so the rate-limit path is what's asserted.
vi.mock('@/lib/validators', () => ({
  consentSchema: {},
  validateBody: (_schema: unknown, body: unknown) => ({ success: true as const, data: body }),
}));

const { POST } = await import('@/app/api/rider/consent/route');

const RIDER_A = { riderDbId: 'rider-A', phone: '9876543210' };
const RIDER_B = { riderDbId: 'rider-B', phone: '9876543211' };

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost:8081/api/rider/consent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { consentType: 'TERMS', granted: true };

function makeFakeConsent(id: string) {
  return {
    id,
    consentType: 'TERMS',
    granted: true,
    policyVersion: 'public-beta-v1',
    createdAt: new Date('2026-09-10T12:00:00.000Z'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbConsentCreateMock.mockImplementation(({ data }: any) =>
    Promise.resolve(makeFakeConsent(`consent-${data.consentType}`))
  );
});

describe('POST /api/rider/consent — P1-4 per-rider rate limit (10/min)', () => {
  it('allows up to 10 requests per rider per minute', async () => {
    requireRiderSessionMock.mockResolvedValue(RIDER_A);
    let callIndex = 0;
    checkRateLimitMock.mockImplementation(async () => {
      callIndex += 1;
      return {
        allowed: callIndex <= 10,
        remaining: Math.max(0, 10 - callIndex),
        resetAt: Date.now() + 60_000,
      };
    });

    for (let i = 0; i < 10; i++) {
      const res = await POST(makePost(VALID_BODY));
      expect(res.status).toBe(200);
    }

    expect(checkRateLimitMock).toHaveBeenCalledTimes(10);
    // Key MUST scope to the rider — not global, not by IP.
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      `rider:consent:${RIDER_A.riderDbId}`,
      expect.objectContaining({ windowMs: 60_000, maxRequests: 10 })
    );
    expect(dbConsentCreateMock).toHaveBeenCalledTimes(10);
  });

  it('returns 429 with a friendly error when the 11th request in the same window arrives', async () => {
    requireRiderSessionMock.mockResolvedValue(RIDER_A);
    // Simulate the 11th call: bucket full.
    checkRateLimitMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const res = await POST(makePost(VALID_BODY));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.message).toMatch(/too many consent submissions/i);
    // Critical: 429 must short-circuit BEFORE the DB write. The whole
    // point of the cap is to stop the row spam; if a 429 still wrote
    // a row, the cap is broken.
    expect(dbConsentCreateMock).not.toHaveBeenCalled();
  });

  it('treats different riders as independent buckets (no cross-rider blocking)', async () => {
    // Rider A hits the cap.
    requireRiderSessionMock.mockResolvedValueOnce(RIDER_A);
    checkRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    const blocked = await POST(makePost(VALID_BODY));
    expect(blocked.status).toBe(429);

    // Rider B should still get 200 — A's quota is not B's problem.
    requireRiderSessionMock.mockResolvedValueOnce(RIDER_B);
    checkRateLimitMock.mockResolvedValueOnce({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });
    const allowed = await POST(makePost(VALID_BODY));
    expect(allowed.status).toBe(200);

    // The keys passed to checkRateLimit must be different per rider.
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(
      1,
      `rider:consent:${RIDER_A.riderDbId}`,
      expect.any(Object)
    );
    expect(checkRateLimitMock).toHaveBeenNthCalledWith(
      2,
      `rider:consent:${RIDER_B.riderDbId}`,
      expect.any(Object)
    );
  });

  it('does not consume the rate-limit budget when the request is unauthorized (401 short-circuits first)', async () => {
    // Auth runs before rate-limit in the route. A 401 should never
    // touch the bucket — otherwise an unauthenticated attacker could
    // burn down a real rider's quota with forged requests.
    const { errors } = await import('@/lib/api-response');
    requireRiderSessionMock.mockResolvedValueOnce(errors.unauthorized('Authentication required'));

    const res = await POST(makePost(VALID_BODY));
    expect(res.status).toBe(401);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(dbConsentCreateMock).not.toHaveBeenCalled();
  });

  it('stamps source=SERVER for legal consent types and source=DEVICE for permission types', async () => {
    // Re-run with two distinct bodies to confirm the LEGAL_CONSENT_TYPES
    // set inside the route is wired correctly. This is the existing
    // P1-2 server-side half — we pin it here so a future enum change
    // can't silently flip a legal consent to DEVICE (which would defeat
    // the audit trail the rate limit protects).
    requireRiderSessionMock.mockResolvedValue(RIDER_A);
    checkRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });

    // Legal type → SERVER.
    const legalRes = await POST(makePost({ consentType: 'PRIVACY', granted: true }));
    expect(legalRes.status).toBe(200);
    expect(dbConsentCreateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'SERVER', consentType: 'PRIVACY' }),
      })
    );

    // Permission type → DEVICE.
    const permRes = await POST(makePost({ consentType: 'LOCATION', granted: true }));
    expect(permRes.status).toBe(200);
    expect(dbConsentCreateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'DEVICE', consentType: 'LOCATION' }),
      })
    );
  });
});
