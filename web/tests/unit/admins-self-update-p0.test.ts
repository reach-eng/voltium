/**
 * TG-4 + TG-5 (2026-08-05 ops audit) — PUT /api/admin/admins self-update guard.
 *
 * P0-3 fixes:
 *   - An admin editing their OWN account may only change name/email — role,
 *     permissions, and isActive changes are rejected (self-lockout / silent
 *     demotion via a stolen cookie).
 *   - Any password change requires currentPassword, verified against the
 *     ACTOR's own hash (re-authentication) — NOT the target's, which would
 *     deadlock password recovery. (Review follow-up, 2026-08-05.)
 *   - Responses never include the password hash (listAdmins already stripped).
 *   - P1-1: role changes can't escalate above the actor's own rank.
 *   - P1-2: PUT is rate-limited (30/min) to protect the Argon2id hashing CPU.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
  hasPermission: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  getAdmin: vi.fn(),
  updateAdmin: vi.fn(),
  createAdmin: vi.fn(),
  createAuditLog: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: mocks.adminForbidden,
}));

vi.mock('@/lib/auth', () => ({ hasPermission: mocks.hasPermission }));

vi.mock('@/lib/password', () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));

vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

vi.mock('@/server/modules/admin/admin.use-cases', () => ({
  adminUseCases: { getAdmin: mocks.getAdmin, updateAdmin: mocks.updateAdmin, createAdmin: mocks.createAdmin },
}));

import { PUT, POST } from '@/app/api/admin/admins/route';
import { ADMIN_ROLE_RANK, AdminRole } from '@/server/modules/admin/admin.types';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/admins', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/admins', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const ACTOR_ID = 'admin_self_1';

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAdmin.mockResolvedValue({
    adminId: ACTOR_ID,
    adminRole: 'SUPER_ADMIN',
    riderDbId: null,
    ...overrides,
  });
  mocks.hasPermission.mockReturnValue(true);
  mocks.adminForbidden.mockReturnValue(new Response('forbidden', { status: 403 }));
  mocks.hashPassword.mockResolvedValue('hashed_new');
  mocks.verifyPassword.mockResolvedValue({ valid: true, needsRehash: false });
  mocks.getAdmin.mockResolvedValue({
    id: ACTOR_ID,
    email: 'self@voltium.in',
    password: 'hashed_current',
    role: 'SUPER_ADMIN',
  });
  mocks.updateAdmin.mockResolvedValue({
    id: ACTOR_ID,
    email: 'self@voltium.in',
    password: 'hashed_new',
    name: 'Self',
    role: 'SUPER_ADMIN',
  });
}

describe('TG-4: self-update cannot change role/permissions/isActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it('rejects self role change with 400', async () => {
    const res = await PUT(makeRequest({ id: ACTOR_ID, role: 'READ_ONLY' }));
    expect(res.status).toBe(400);
    expect(mocks.updateAdmin).not.toHaveBeenCalled();
  });

  it('rejects self deactivation with 400', async () => {
    const res = await PUT(makeRequest({ id: ACTOR_ID, isActive: false }));
    expect(res.status).toBe(400);
    expect(mocks.updateAdmin).not.toHaveBeenCalled();
  });

  it('rejects self permissions change with 400', async () => {
    const res = await PUT(makeRequest({ id: ACTOR_ID, permissions: [] }));
    expect(res.status).toBe(400);
    expect(mocks.updateAdmin).not.toHaveBeenCalled();
  });

  it('allows self name/email update', async () => {
    const res = await PUT(makeRequest({ id: ACTOR_ID, name: 'New Name' }));
    expect(res.status).toBe(200);
    expect(mocks.updateAdmin).toHaveBeenCalled();
  });

  it('allows a SUPER_ADMIN to update ANOTHER admin role', async () => {
    mocks.updateAdmin.mockResolvedValue({
      id: 'admin_other_1',
      email: 'other@voltium.in',
      password: 'hashed_other',
      name: 'Other',
      role: 'OPERATIONS_ADMIN',
    });
    const res = await PUT(makeRequest({ id: 'admin_other_1', role: 'OPERATIONS_ADMIN' }));
    expect(res.status).toBe(200);
    expect(mocks.updateAdmin).toHaveBeenCalled();
  });
});

describe('TG-5: password change requires currentPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it('rejects password change without currentPassword with 400', async () => {
    const res = await PUT(makeRequest({ id: ACTOR_ID, password: 'ValidPass123!@#' }));
    expect(res.status).toBe(400);
    expect(mocks.updateAdmin).not.toHaveBeenCalled();
  });

  it('rejects password change with wrong currentPassword', async () => {
    mocks.verifyPassword.mockResolvedValue({ valid: false, needsRehash: false });
    const res = await PUT(
      makeRequest({ id: ACTOR_ID, password: 'ValidPass123!@#', currentPassword: 'wrongpass123' })
    );
    expect(res.status).toBe(400);
    expect(mocks.updateAdmin).not.toHaveBeenCalled();
  });

  it('allows password change with correct currentPassword', async () => {
    const res = await PUT(
      makeRequest({ id: ACTOR_ID, password: 'ValidPass123!@#', currentPassword: 'oldpass123' })
    );
    expect(res.status).toBe(200);
    // Actor-verification semantics: the hash checked is the ACTOR's, not the
    // target's (getAdmin(actorId) is called for the password check).
    expect(mocks.getAdmin).toHaveBeenCalledWith(ACTOR_ID);
    expect(mocks.verifyPassword).toHaveBeenCalledWith('oldpass123', 'hashed_current');
    expect(mocks.hashPassword).toHaveBeenCalledWith('ValidPass123!@#');
    expect(mocks.updateAdmin).toHaveBeenCalled();
  });

  it('verifies password changes on ANOTHER admin against the actor, not the target', async () => {
    const targetId = 'admin_other_2';
    mocks.updateAdmin.mockResolvedValue({
      id: targetId,
      email: 'other@voltium.in',
      password: 'hashed_new',
      name: 'Other',
      role: 'OPERATIONS_ADMIN',
    });
    const res = await PUT(
      makeRequest({ id: targetId, password: 'ValidPass123!@#', currentPassword: 'actorpass' })
    );
    // The target admin's password is never verified — only the actor's
    // password is verified, so a SUPER_ADMIN can reset a forgotten password.
    expect(mocks.getAdmin).toHaveBeenCalledWith(ACTOR_ID);
    expect(mocks.verifyPassword).toHaveBeenCalledWith('actorpass', 'hashed_current');
  });

  it('P1-1: rejects assigning a role ranked above the actor (non-SUPER escalation)', async () => {
    mockSession({ adminRole: 'OPERATIONS_ADMIN' });
    const res = await PUT(makeRequest({ id: 'admin_other_3', role: 'SUPER_ADMIN' }));
    expect(res.status).toBe(403);
    expect(mocks.updateAdmin).not.toHaveBeenCalled();
  });

  it('P0-1 (2026-08-24): deactivation requires a `reason`', async () => {
    const res = await PUT(
      makeRequest({ id: 'admin_target_42', isActive: false })
    );
    expect(res.status).toBe(400);
    expect(mocks.updateAdmin).not.toHaveBeenCalled();
  });

  it('P0-1 (2026-08-24): deactivation with a reason succeeds', async () => {
    mocks.updateAdmin.mockResolvedValue({
      id: 'admin_target_42',
      email: 'target@voltium.in',
      name: 'Target',
      role: 'OPERATIONS_ADMIN',
      isActive: false,
      password: 'hashed',
      permissions: '[]',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });
    const res = await PUT(
      makeRequest({
        id: 'admin_target_42',
        isActive: false,
        reason: 'left the company, security review',
      })
    );
    expect(res.status).toBe(200);
    expect(mocks.updateAdmin).toHaveBeenCalledWith(
      'admin_target_42',
      expect.objectContaining({ isActive: false }),
      ACTOR_ID,
      expect.objectContaining({ reason: 'left the company, security review' })
    );
  });

  it('P0-1 (2026-08-24): activation does NOT require a reason', async () => {
    mocks.updateAdmin.mockResolvedValue({
      id: 'admin_target_42',
      email: 'target@voltium.in',
      name: 'Target',
      role: 'OPERATIONS_ADMIN',
      isActive: true,
      password: 'hashed',
      permissions: '[]',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });
    const res = await PUT(
      makeRequest({ id: 'admin_target_42', isActive: true })
    );
    expect(res.status).toBe(200);
    expect(mocks.updateAdmin).toHaveBeenCalled();
  });

  it('response never contains the password hash', async () => {
    const res = await PUT(
      makeRequest({ id: ACTOR_ID, password: 'ValidPass123!@#', currentPassword: 'oldpass123' })
    );
    const json = await res.json();
    expect(JSON.stringify(json)).not.toContain('hashed_new');
    expect(JSON.stringify(json)).not.toContain('"password"');
  });
});

describe('P1-1: ADMIN_ROLE_RANK hierarchy (security-critical invariant)', () => {
  it('ranks are strictly ordered: SUPER_ADMIN is the max, READ_ONLY the min', () => {
    const ranks = {
      READ_ONLY: ADMIN_ROLE_RANK[AdminRole.READ_ONLY],
      TEAM_LEADER: ADMIN_ROLE_RANK[AdminRole.TEAM_LEADER],
      HUB_MANAGER: ADMIN_ROLE_RANK[AdminRole.HUB_MANAGER],
      FINANCE_ADMIN: ADMIN_ROLE_RANK[AdminRole.FINANCE_ADMIN],
      OPERATIONS_ADMIN: ADMIN_ROLE_RANK[AdminRole.OPERATIONS_ADMIN],
      SUPER_ADMIN: ADMIN_ROLE_RANK[AdminRole.SUPER_ADMIN],
    };
    expect(ranks.SUPER_ADMIN).toBeGreaterThan(ranks.OPERATIONS_ADMIN);
    expect(ranks.OPERATIONS_ADMIN).toBeGreaterThan(ranks.FINANCE_ADMIN);
    expect(ranks.FINANCE_ADMIN).toBeGreaterThan(ranks.HUB_MANAGER);
    expect(ranks.HUB_MANAGER).toBeGreaterThan(ranks.TEAM_LEADER);
    expect(ranks.TEAM_LEADER).toBeGreaterThan(ranks.READ_ONLY);
    expect(ranks.READ_ONLY).toBeGreaterThan(0);
  });

  it('a SUPER_ADMIN can still create another SUPER_ADMIN (rank 7 <= 7)', async () => {
    mockSession({ adminRole: 'SUPER_ADMIN' });
    mocks.createAdmin.mockResolvedValueOnce({
      id: 'admin_new', name: 'Peer', email: 'peer@example.com', role: 'SUPER_ADMIN',
    });
    const res = await POST(makePostRequest({ name: 'Peer', email: 'peer@example.com', password: 'ValidPass123!@#', role: 'SUPER_ADMIN' }));
    expect(res.status).toBe(201);
    expect(mocks.createAdmin).toHaveBeenCalled();
  });
});
