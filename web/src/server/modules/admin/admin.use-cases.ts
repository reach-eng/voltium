import {
  adminRepository,
  type CreateAdminParams,
  type UpdateAdminParams,
} from './admin.repository';
import { AUDIT_ACTIONS } from './admin.types';
import { logAdminAction } from './admin.policy';
import { parsePermissions } from '@/lib/permissions';
import { LoginError } from './login-error';

export { LoginError } from './login-error';
export type { LoginErrorCode } from './login-error';

export const adminUseCases = {
  async listAdmins(filters?: {
    role?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20, ...rest } = filters || {};
    const [result, total] = await Promise.all([
      adminRepository.list({ page, limit, ...rest }),
      adminRepository.count(rest),
    ]);
    const sanitized = result.map(({ password: _pw, ...safe }: (typeof result)[number]) => safe);
    return {
      admins: sanitized,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getAdmin(id: string) {
    const admin = await adminRepository.findById(id);
    if (!admin) throw new Error('Admin not found');
    return admin;
  },

  async createAdmin(params: CreateAdminParams, actorId: string) {
    const existing = await adminRepository.findByEmail(params.email);
    if (existing) {
      throw new Error('An admin with this email already exists');
    }

    const admin = await adminRepository.create(params);

    await logAdminAction({
      actorId,
      action: AUDIT_ACTIONS.ADMIN_CREATE,
      entity: 'admin',
      entityId: admin.id,
      details: { email: params.email, role: params.role, permissions: params.permissions ?? [] },
    });

    return admin;
  },

  async updateAdmin(id: string, params: UpdateAdminParams, actorId: string) {
    const existing = await adminRepository.findById(id);
    if (!existing) {
      throw new Error('Admin not found');
    }

    const admin = await adminRepository.update(id, params);

    await logAdminAction({
      actorId,
      action: AUDIT_ACTIONS.ADMIN_UPDATE,
      entity: 'admin',
      entityId: id,
      details: { changes: (({ password, ...safe }) => safe)(params) },
    });

    return admin;
  },

  async deleteAdmin(id: string, actorId: string) {
    if (id === actorId) {
      throw new Error('Cannot delete or deactivate your own admin account');
    }

    const existing = await adminRepository.findById(id);
    if (!existing) {
      throw new Error('Admin not found');
    }

    if (existing.role === 'SUPER_ADMIN') {
      const superAdminCount = await adminRepository.count({ role: 'SUPER_ADMIN', isActive: true });
      if (superAdminCount <= 1 && existing.isActive) {
        throw new Error('Cannot deactivate the last active SUPER_ADMIN account');
      }
    }

    // Soft deactivate per user preference
    await adminRepository.update(id, { isActive: false });

    await logAdminAction({
      actorId,
      action: AUDIT_ACTIONS.ADMIN_DELETE,
      entity: 'admin',
      entityId: id,
      details: { email: existing.email, softDeactivated: true },
    });
  },

  async getAuditLogs(filters: {
    entity?: string;
    entityId?: string;
    actorId?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    return adminRepository.getAuditLogs(filters);
  },

  async login(email: string, password: string) {
    // P0-4: the in-memory loginAttempts Map is gone. It was per-process
    // (reset on every cold start), keyed per (email, IP) instead of per
    // email (so a botnet got 1000×5 attempts), and leaked a setTimeout per
    // failure. Rate limiting now lives in the route layer, DB-backed
    // (per-IP + per-email).
    const admin = await adminRepository.findByEmail(email);
    if (!admin) {
      throw new LoginError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const { verifyPassword, hashPassword } = await import('@/lib/password');
    const result = await verifyPassword(password, admin.password);
    if (!result.valid) {
      throw new LoginError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // P0-7: verify credentials FIRST, then surface deactivation only to the
    // holder. Probing a deactivated account without the password still gets
    // the generic 401, so we don't leak account state to attackers.
    if (!admin.isActive) {
      throw new LoginError(
        'Account deactivated. Contact an administrator.',
        'ACCOUNT_DEACTIVATED'
      );
    }

    // Migrate to Argon2id if needed (legacy PBKDF2 → Argon2id)
    if (result.needsRehash) {
      const newHash = await hashPassword(password);
      await adminRepository.update(admin.id, { password: newHash }).catch(() => {});
    }

    await adminRepository.updateLastLogin(admin.id);
    return admin;
  },

  /**
   * P3-17: get the admin profile for the /me endpoint.
   *
   * Contract:
   * - Returns the admin row with the password hash STRIPPED and permissions
   *   resolved to a string[] (both `permissions` and `adminPermissions` are
   *   set for backward compat).
   * - Returns null when the admin no longer exists (route maps it to 401).
   * - DB failures PROPAGATE (no swallowing) so the route can return 503
   *   instead of a misleading 403 (P0-8).
   *
   * P0-6: no dead hasPermissions / Array.isArray branches. The permissions
   * column is TEXT[] (legacy R6 column); parsePermissions handles arrays and
   * JSON strings alike.
   */
  async getMe(adminId: string) {
    const admin = await adminRepository.findById(adminId);
    if (!admin) return null;
    const permissions = parsePermissions(admin.permissions);
    const { password: _password, ...safe } = admin;
    return { ...safe, permissions, adminPermissions: permissions };
  },

  async logout(adminId: string) {
    await adminRepository.incrementTokenVersion(adminId);
  },
};
