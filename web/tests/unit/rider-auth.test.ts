/**
 * Rider Auth Module — Unit Tests
 *
 * Tests requireRiderSession() from src/lib/rider-auth.ts
 *
 * Covers:
 *   - Valid rider session returns riderDbId and phone
 *   - No session returns 401 unauthorized response
 *   - Admin session with riderId header/param returns impersonated session
 *   - Admin session without riderId returns 401
 *   - Logged impersonation via audit-log
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSession = vi.fn();
const mockGetAdminSession = vi.fn();
const mockCreateAuditLog = vi.fn();

const mockRiderFindFirst = vi.fn().mockImplementation(({ where }) => {
  const targetId = where?.id || (where?.OR && (where.OR[0]?.id || where.OR[1]?.riderId)) || 'rider-1';
  return Promise.resolve({ id: targetId, phone: '0000000000' });
});

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findFirst: (...args: any[]) => mockRiderFindFirst(...args),
    },
  },
}));

vi.mock('@/lib/get-session', () => ({
  getSession: mockGetSession,
  getAdminSession: mockGetAdminSession,
}));

vi.mock('@/lib/api-response', () => ({
  errors: {
    unauthorized: vi.fn(
      (msg: string) =>
        new Response(
          JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: msg } }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }
        )
    ),
    forbidden: vi.fn(
      (msg: string) =>
        new Response(
          JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: msg } }),
          {
            status: 403,
            headers: { 'content-type': 'application/json' },
          }
        )
    ),
    notFound: vi.fn(
      (msg: string) =>
        new Response(
          JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: msg } }),
          {
            status: 404,
            headers: { 'content-type': 'application/json' },
          }
        )
    ),
    tooManyRequests: vi.fn(
      (msg: string) =>
        new Response(
          JSON.stringify({ success: false, error: { code: 'RATE_LIMITED', message: msg } }),
          {
            status: 429,
            headers: { 'content-type': 'application/json' },
          }
        )
    ),
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mockCreateAuditLog,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { requireRiderSession } = await import('../../src/lib/rider-auth');

// ---------------------------------------------------------------------------
// Test env: enable admin impersonation path for tests that exercise it.
// The dev-only path requires ENABLE_RIDER_IMPERSONATION=true AND
// APP_ENV !== 'production'. Tests that don't want impersonation enabled
// should explicitly clear ENABLE_RIDER_IMPERSONATION.
// ---------------------------------------------------------------------------
beforeAll(() => {
  process.env.ENABLE_RIDER_IMPERSONATION = 'true';
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock NextRequest-like object with nextUrl support.
 * Uses a plain Request and augments it with a mock nextUrl.
 * This matches how NextRequest works (Request subclass + nextUrl).
 */
function createMockRequest(
  url: string = 'http://localhost:8081/api/rider/profile',
  headers: Record<string, string> = {}
) {
  const req = new Request(url, { headers });

  // Augment with nextUrl (simulating NextRequest's behavior)
  const nextUrl = new URL(url);
  Object.defineProperty(req, 'nextUrl', {
    value: nextUrl,
    writable: false,
    configurable: true,
  });

  return req;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireRiderSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Valid rider session ─────────────────────────────────────────────────

  it('returns riderDbId and phone when a valid rider session exists', async () => {
    mockGetSession.mockResolvedValue({
      riderId: 'VF-RD-TEST123',
      riderDbId: 'db-id-456',
      phone: '9876543210',
      role: 'rider',
    });

    const request = createMockRequest();
    const result = await requireRiderSession(request);

    expect(result).toEqual({ riderDbId: 'db-id-456', phone: '9876543210' });
    expect(mockGetSession).toHaveBeenCalledWith(request);
    expect(mockGetAdminSession).not.toHaveBeenCalled();
  });

  it('returns rider session with admin fields present (non-admin role)', async () => {
    mockGetSession.mockResolvedValue({
      riderId: 'VF-RD-TEST123',
      riderDbId: 'db-id-456',
      phone: '9876543210',
      role: 'rider',
      adminRole: undefined,
      adminId: undefined,
      adminPermissions: undefined,
    });

    const result = await requireRiderSession(createMockRequest());
    expect(result).toEqual({ riderDbId: 'db-id-456', phone: '9876543210' });
  });

  // ── No session — unauthorized ───────────────────────────────────────────

  it('returns 401 unauthorized when no session exists', async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetAdminSession.mockResolvedValue(null);

    const request = createMockRequest();
    const result = await requireRiderSession(request);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    const body = await (result as Response).json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Authentication required');
  });

  it('returns 401 when getSession returns null and admin session also returns null', async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetAdminSession.mockResolvedValue(null);

    const result = await requireRiderSession(createMockRequest());
    expect((result as Response).status).toBe(401);
  });

  it('does not attempt admin impersonation when rider session exists', async () => {
    mockGetSession.mockResolvedValue({
      riderId: 'VF-RD-TEST123',
      riderDbId: 'db-id-456',
      phone: '9876543210',
      role: 'rider',
    });

    await requireRiderSession(createMockRequest());
    expect(mockGetAdminSession).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  // ── Admin impersonation via query param (removed — should fail) ────────────

  it('rejects impersonation via riderId query param (no header)', async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetAdminSession.mockResolvedValue({
      riderId: 'VF-AD-MGR789',
      riderDbId: 'db-id-789',
      phone: '9876543211',
      role: 'admin',
      adminRole: 'OPERATIONS_ADMIN',
      adminId: 'admin-001',
    });

    const request = createMockRequest(
      'http://localhost:8081/api/admin/riders?riderId=impersonated-rider-id'
    );
    const result = await requireRiderSession(request);

    // Query param is no longer accepted — should return 401
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  // ── Admin impersonation via header ───────────────────────────────────────

  it('allows admin with x-rider-id header to impersonate a rider', async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetAdminSession.mockResolvedValue({
      riderId: 'VF-AD-MGR789',
      riderDbId: 'db-id-789',
      phone: '9876543211',
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
      adminId: 'admin-002',
    });

    const request = createMockRequest('http://localhost:8081/api/admin/kyc', {
      'x-rider-id': 'header-rider-id',
    });
    const result = await requireRiderSession(request);

    expect(result).toEqual({ riderDbId: 'header-rider-id', phone: '0000000000' });
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IMPERSONATE_RIDER',
        entityId: 'header-rider-id',
      })
    );
  });

  // ── Admin impersonation: header-only (query param removed) ───────────────

  it('uses x-rider-id header when no query param is present', async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetAdminSession.mockResolvedValue({
      riderId: 'VF-AD-MGR789',
      riderDbId: 'db-id-789',
      phone: '9876543211',
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
      adminId: 'admin-003',
    });

    const request = createMockRequest('http://localhost:8081/api/admin/kyc', {
      'x-rider-id': 'header-id',
    });
    const result = await requireRiderSession(request);

    expect(result).toEqual({ riderDbId: 'header-id', phone: '0000000000' });
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'header-id' })
    );
  });

  // ── Admin session without riderId ────────────────────────────────────────

  it('returns 401 when admin session exists but no riderId is provided', async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetAdminSession.mockResolvedValue({
      riderId: 'VF-AD-MGR789',
      riderDbId: 'db-id-789',
      phone: '9876543211',
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
      adminId: 'admin-003',
    });

    const request = createMockRequest();
    const result = await requireRiderSession(request);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  // ── Admin impersonation with adminId fallback ────────────────────────────

  it('uses admin riderDbId when adminId is not set', async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetAdminSession.mockResolvedValue({
      riderId: 'VF-AD-MGR789',
      riderDbId: 'fallback-id',
      phone: '9876543211',
      role: 'admin',
      adminRole: 'SUPPORT_AGENT',
      adminPermissions: ['impersonate_riders'],
      // no adminId
    });

    const request = createMockRequest('http://localhost:8081/api/admin/riders', {
      'x-rider-id': 'impersonated-id',
    });
    const result = await requireRiderSession(request);

    expect(result).toEqual({ riderDbId: 'impersonated-id', phone: '0000000000' });
    // Should use riderDbId as fallback for actorId
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'fallback-id',
      })
    );
  });

  // ── Admin session with no adminRole ──────────────────────────────────────

  it('handles admin session with no adminRole gracefully', async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetAdminSession.mockResolvedValue({
      riderId: 'VF-AD-MGR789',
      riderDbId: 'db-id-789',
      phone: '9876543211',
      role: 'admin',
      adminPermissions: ['impersonate_riders'],
      // no adminRole set
    });

    const request = createMockRequest('http://localhost:8081/api/admin/kyc', {
      'x-rider-id': 'rider-xyz',
    });
    const result = await requireRiderSession(request);

    expect(result).toEqual({ riderDbId: 'rider-xyz', phone: '0000000000' });
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ details: JSON.stringify({ adminRole: undefined }) })
    );
  });

  // ── Admin impersonation: Restricted methods & permissions ──────────────────

  it('rejects impersonation for non-GET methods', async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetAdminSession.mockResolvedValue({
      riderId: 'VF-AD-MGR789',
      riderDbId: 'db-id-789',
      phone: '9876543211',
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
    });

    const request = createMockRequest('http://localhost:8081/api/admin/kyc', {
      'x-rider-id': 'rider-xyz',
    });
    // Force method to POST
    Object.defineProperty(request, 'method', { value: 'POST' });

    const result = await requireRiderSession(request);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it('rejects impersonation when admin lacks impersonate_riders permission', async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetAdminSession.mockResolvedValue({
      riderId: 'VF-AD-MGR789',
      riderDbId: 'db-id-789',
      phone: '9876543211',
      role: 'admin',
      adminRole: 'SUPPORT_AGENT', // SUPPORT_AGENT doesn't have it by default
      adminPermissions: [], // Explicitly no permissions overrides
    });

    const request = createMockRequest('http://localhost:8081/api/admin/kyc', {
      'x-rider-id': 'rider-xyz',
    });

    const result = await requireRiderSession(request);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  // ── Phase 6.1: impersonation gated behind env flag ──────────────────────

  it('rejects impersonation when ENABLE_RIDER_IMPERSONATION is not set', async () => {
    // Save and clear the flag for this test only
    const prev = process.env.ENABLE_RIDER_IMPERSONATION;
    delete process.env.ENABLE_RIDER_IMPERSONATION;

    try {
      mockGetSession.mockResolvedValue(null);
      mockGetAdminSession.mockResolvedValue({
        riderId: 'VF-AD-MGR789',
        riderDbId: 'db-id-789',
        phone: '9876543211',
        role: 'admin',
        adminRole: 'SUPER_ADMIN',
        adminId: 'admin-001',
        adminPermissions: ['impersonate_riders'],
      });

      const request = createMockRequest('http://localhost:8081/api/admin/kyc', {
        'x-rider-id': 'header-rider-id',
      });
      const result = await requireRiderSession(request);

      // No env flag = impersonation disabled = 401
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
    } finally {
      process.env.ENABLE_RIDER_IMPERSONATION = prev;
    }
  });

  it('rejects impersonation when APP_ENV=production even with env flag set', async () => {
    const prevFlag = process.env.ENABLE_RIDER_IMPERSONATION;
    const prevAppEnv = process.env.APP_ENV;
    process.env.ENABLE_RIDER_IMPERSONATION = 'true';
    process.env.APP_ENV = 'production';

    try {
      mockGetSession.mockResolvedValue(null);
      mockGetAdminSession.mockResolvedValue({
        riderId: 'VF-AD-MGR789',
        riderDbId: 'db-id-789',
        phone: '9876543211',
        role: 'admin',
        adminRole: 'SUPER_ADMIN',
        adminId: 'admin-001',
        adminPermissions: ['impersonate_riders'],
      });

      const request = createMockRequest('http://localhost:8081/api/admin/kyc', {
        'x-rider-id': 'header-rider-id',
      });
      const result = await requireRiderSession(request);

      // Production = impersonation always disabled = 401
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
    } finally {
      process.env.ENABLE_RIDER_IMPERSONATION = prevFlag;
      process.env.APP_ENV = prevAppEnv;
    }
  });
});
