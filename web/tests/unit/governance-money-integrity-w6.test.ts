import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { validateTransactionTransition, TransactionStateError } from '@/server/modules/transactions/transaction-state-machine';
import { awardRewardSchema } from '@/lib/validators';

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
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  logAdminMutation: vi.fn().mockResolvedValue(undefined),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));
vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: (msg?: string) => new Response(JSON.stringify({ error: msg || 'forbidden' }), { status: 403 }),
}));
vi.mock('@/lib/auth', () => ({
  hasPermission: mocks.hasPermission,
  parsePermissions: vi.fn().mockReturnValue([]),
}));
vi.mock('@/lib/password', () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.createAuditLog,
  logAdminMutation: mocks.logAdminMutation,
}));
vi.mock('@/server/modules/admin/admin.use-cases', () => ({
  adminUseCases: {
    getAdmin: mocks.getAdmin,
    updateAdmin: mocks.updateAdmin,
    createAdmin: mocks.createAdmin,
    listAdmins: vi.fn(),
  },
}));

import { PUT, POST } from '@/app/api/admin/admins/route';

describe('Phase W6: Governance & Money Integrity Criticals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('G-1: Actor-Target Hierarchy Rank Checks', () => {
    it('blocks a TEAM_LEADER from resetting a SUPER_ADMIN password or updating their profile', async () => {
      mocks.requireAdmin.mockResolvedValue({
        adminId: 'actor_tl_1',
        adminRole: 'TEAM_LEADER',
      });
      mocks.hasPermission.mockReturnValue(true);
      mocks.getAdmin.mockImplementation(async (id: string) => {
        if (id === 'target_super_admin') {
          return { id: 'target_super_admin', role: 'SUPER_ADMIN', name: 'Super Admin', email: 'super@voltium.io' };
        }
        return { id: 'actor_tl_1', role: 'TEAM_LEADER', name: 'TL', email: 'tl@voltium.io', password: 'hashed' };
      });
      mocks.verifyPassword.mockResolvedValue({ valid: true });

      const req = new NextRequest('http://localhost/api/admin/admins', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'target_super_admin',
          password: 'NewPassword123!@#',
          currentPassword: 'tl_current_password',
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(403);
      expect(mocks.updateAdmin).not.toHaveBeenCalled();
      expect(mocks.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SECURITY_VIOLATION',
        })
      );
    });

    it('blocks an OPERATIONS_ADMIN from modifying another OPERATIONS_ADMIN (equal rank)', async () => {
      mocks.requireAdmin.mockResolvedValue({
        adminId: 'actor_ops_1',
        adminRole: 'OPERATIONS_ADMIN',
      });
      mocks.hasPermission.mockReturnValue(true);
      mocks.getAdmin.mockImplementation(async (id: string) => {
        if (id === 'target_ops_2') {
          return { id: 'target_ops_2', role: 'OPERATIONS_ADMIN', name: 'Peer Ops', email: 'ops2@voltium.io' };
        }
        return { id: 'actor_ops_1', role: 'OPERATIONS_ADMIN', name: 'Actor Ops', email: 'ops1@voltium.io' };
      });

      const req = new NextRequest('http://localhost/api/admin/admins', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'target_ops_2',
          isActive: false,
          reason: 'Attempted peer deactivation',
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(403);
      expect(mocks.updateAdmin).not.toHaveBeenCalled();
    });

    it('allows an OPERATIONS_ADMIN to modify a strictly lower-ranked TEAM_LEADER', async () => {
      mocks.requireAdmin.mockResolvedValue({
        adminId: 'actor_ops_1',
        adminRole: 'OPERATIONS_ADMIN',
      });
      mocks.hasPermission.mockReturnValue(true);
      mocks.getAdmin.mockImplementation(async (id: string) => {
        if (id === 'target_tl_1') {
          return { id: 'target_tl_1', role: 'TEAM_LEADER', name: 'TL', email: 'tl@voltium.io' };
        }
        return { id: 'actor_ops_1', role: 'OPERATIONS_ADMIN', name: 'Actor Ops', email: 'ops1@voltium.io' };
      });
      mocks.updateAdmin.mockResolvedValue({
        id: 'target_tl_1',
        role: 'TEAM_LEADER',
        isActive: false,
      });

      const req = new NextRequest('http://localhost/api/admin/admins', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'target_tl_1',
          isActive: false,
          reason: 'Seasonal team lead shift ended',
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(200);
      expect(mocks.updateAdmin).toHaveBeenCalled();
    });
  });

  describe('G-2: Privilege Escalation Prevention on Permissions', () => {
    it('rejects PUT permission grant when non-SUPER_ADMIN actor does not hold the requested permission', async () => {
      mocks.requireAdmin.mockResolvedValue({
        adminId: 'actor_ops_1',
        adminRole: 'OPERATIONS_ADMIN',
      });
      // Actor holds admins_manage, but NOT settings_manage
      mocks.hasPermission.mockImplementation((_session: any, perm: string) => {
        return perm === 'admins_manage';
      });
      mocks.getAdmin.mockImplementation(async (id: string) => {
        if (id === 'target_tl_1') {
          return { id: 'target_tl_1', role: 'TEAM_LEADER', name: 'TL', email: 'tl@voltium.io' };
        }
        return { id: 'actor_ops_1', role: 'OPERATIONS_ADMIN', name: 'Actor Ops', email: 'ops1@voltium.io' };
      });

      const req = new NextRequest('http://localhost/api/admin/admins', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'target_tl_1',
          permissions: ['settings_manage'],
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(403);
      expect(mocks.updateAdmin).not.toHaveBeenCalled();
      expect(mocks.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SECURITY_VIOLATION',
        })
      );
    });

    it('rejects POST admin create when non-SUPER_ADMIN actor attempts to grant unheld permissions', async () => {
      mocks.requireAdmin.mockResolvedValue({
        adminId: 'actor_ops_1',
        adminRole: 'OPERATIONS_ADMIN',
      });
      mocks.hasPermission.mockImplementation((_session: any, perm: string) => {
        return perm === 'admins_manage';
      });

      const req = new NextRequest('http://localhost/api/admin/admins', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Sub-Admin',
          email: 'sub@voltium.io',
          password: 'Password123!@#',
          role: 'TEAM_LEADER',
          permissions: ['settings_manage'],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      expect(mocks.createAdmin).not.toHaveBeenCalled();
    });
  });

  describe('G-3: Password Hash Stripping on Create', () => {
    it('ensures POST /api/admin/admins does not return the password hash', async () => {
      mocks.requireAdmin.mockResolvedValue({
        adminId: 'actor_super_1',
        adminRole: 'SUPER_ADMIN',
      });
      mocks.hasPermission.mockReturnValue(true);
      mocks.createAdmin.mockResolvedValue({
        id: 'new_admin_id',
        name: 'New Admin',
        email: 'newadmin@voltium.io',
        role: 'FINANCE_ADMIN',
        password: 'argon2id$v=19$m=65536,t=3,p=4$secret_argon_hash',
      });

      const req = new NextRequest('http://localhost/api/admin/admins', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Admin',
          email: 'newadmin@voltium.io',
          password: 'Password123!@#',
          role: 'FINANCE_ADMIN',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.password).toBeUndefined();
      expect(JSON.stringify(json)).not.toContain('secret_argon_hash');
    });
  });

  describe('M-1: Transaction Double-Reversal Elimination', () => {
    it('rejects transition when currentStatus === targetStatus in state machine', () => {
      expect(() => validateTransactionTransition('REVERSED', 'REVERSED')).toThrow(TransactionStateError);
      expect(() => validateTransactionTransition('APPROVED', 'APPROVED')).toThrow(TransactionStateError);
      expect(() => validateTransactionTransition('REFUNDED', 'REFUNDED')).toThrow(TransactionStateError);
    });
  });

  describe('M-3: Rewards Math and Schema Bounds', () => {
    it('awardRewardSchema enforces max 100,000 points limit', () => {
      const valid = awardRewardSchema.safeParse({
        riderDbId: 'rider_1',
        title: 'Safety Bonus',
        points: 20000,
      });
      expect(valid.success).toBe(true);

      const invalid = awardRewardSchema.safeParse({
        riderDbId: 'rider_1',
        title: 'Exploit Bonus',
        points: 200000,
      });
      expect(invalid.success).toBe(false);
    });
  });
});
