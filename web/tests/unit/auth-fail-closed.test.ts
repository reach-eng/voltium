import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// P1-19: verifySessionToken must FAIL CLOSED for admin sessions when the
// tokenVersion DB check errors. A DB outage must never make a possibly-
// revoked admin token valid. Rider tokens stay lenient (no sensitive
// endpoints).
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  adminFindUnique: vi.fn(),
  riderFindUnique: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    admin: { findUnique: mocks.adminFindUnique },
    rider: { findUnique: mocks.riderFindUnique },
  },
}));

import { createSessionToken, createRefreshToken, verifySessionToken } from '@/lib/auth';

const riderPayload = {
  riderId: 'rider-1',
  riderDbId: 'rider-db-1',
  phone: '9999999999',
  role: 'rider',
};

function adminPayload(adminId: string) {
  return {
    riderId: `vf-admin-${adminId}`,
    riderDbId: `admin-db-${adminId}`,
    phone: '9999999998',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    adminId,
  };
}

describe('verifySessionToken fail-closed on DB error (P1-19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an admin access token when the admin DB check fails', async () => {
    mocks.adminFindUnique.mockRejectedValue(new Error('db down'));
    const token = await createSessionToken(adminPayload('admin-db-down-1'));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it('rejects an admin refresh token when the admin DB check fails', async () => {
    mocks.adminFindUnique.mockRejectedValue(new Error('db down'));
    const token = await createRefreshToken(adminPayload('admin-db-down-2'));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it('still verifies a rider token when the rider DB check fails (lenient by design)', async () => {
    mocks.riderFindUnique.mockRejectedValue(new Error('db down'));
    const token = await createSessionToken(riderPayload);
    const decoded = await verifySessionToken(token);
    expect(decoded?.riderId).toBe('rider-1');
  });

  it('verifies an admin token when the DB lookup succeeds', async () => {
    mocks.adminFindUnique.mockResolvedValue({
      tokenVersion: 1,
      isActive: true,
      role: 'SUPER_ADMIN',
      permissions: null,
    });
    const token = await createSessionToken(adminPayload('admin-db-ok'));
    const decoded = await verifySessionToken(token);
    expect(decoded?.adminId).toBe('admin-db-ok');
  });

  it('still rejects a deactivated admin even on a successful DB lookup', async () => {
    mocks.adminFindUnique.mockResolvedValue({
      tokenVersion: 1,
      isActive: false,
      role: 'SUPER_ADMIN',
      permissions: null,
    });
    const token = await createSessionToken(adminPayload('admin-deactivated'));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it('rejects an admin token whose version was rotated (revoked)', async () => {
    mocks.adminFindUnique.mockResolvedValue({
      tokenVersion: 4,
      isActive: true,
      role: 'SUPER_ADMIN',
      permissions: null,
    });
    const token = await createSessionToken(adminPayload('admin-revoked'));
    expect(await verifySessionToken(token)).toBeNull();
  });
});
