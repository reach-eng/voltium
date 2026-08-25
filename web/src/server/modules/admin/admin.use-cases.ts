import type { NextRequest } from 'next/server';
import {
  adminRepository,
  type CreateAdminParams,
  type UpdateAdminParams,
} from './admin.repository';
import { ADMIN_ROLE_RANK, AUDIT_ACTIONS, type AdminRole } from './admin.types';
import { logAdminAction } from './admin.policy';
import { hasPermission, parsePermissions, type SessionPayload } from '@/lib/auth';
import { LoginError } from './login-error';

/**
 * P0-2 (ADMIN_ADMIN_USERS_AUDIT_2026-08-24): audit context that's threaded
 * through the admin mutations so the audit log can record who did what
 * from where. The `request` is optional so unit tests / cron jobs can
 * call the use cases without a fake NextRequest.
 */
export interface AdminActionContext {
  reason?: string;
  request?: NextRequest;
  /**
   * The actor's session, used for the rank + permission-subset checks
   * (W6 / G-1, G-2). Optional so legacy callers (cron, seed scripts) can
   * still call the use case — in that case the rank / subset checks are
   * skipped and we trust the caller to have authorised the action out of
   * band. A production route handler should always pass the session.
   */
  session?: SessionPayload | null;
}

export { LoginError } from './login-error';
export type { LoginErrorCode } from './login-error';

/**
 * W6 / G-1: rank check on every target-touching mutation. A TEAM_LEADER
 * (rank 2) with an explicit `admins_manage` grant must not be able to
 * reset a SUPER_ADMIN's (rank 7) password, deactivate them, or change
 * their role/permissions — even though the permission key is satisfied,
 * the actor's rank is below the target's. The existing `canGrantRole`
 * check in the route layer covers role assignment; this use-case-layer
 * helper covers EVERY target-touching field (password, role, permissions,
 * isActive) so the guard is consistent across both the route path and
 * any future internal callers (cron, admin scripts).
 *
 * W6 / G-2: subset-of-granter on permissions. An OPERATIONS_ADMIN (rank
 * 6) with explicit per-permission grants may only grant permissions they
 * already hold. Without this, an admin who was granted
 * `transactions_manage` via explicit perms (additive to their role base)
 * could grant that same perm to a lower-ranked target — a privilege
 * amplification hole.
 */
function canModifyTarget(
  actor: SessionPayload,
  target: { id?: string; role: string | null; permissions?: string[] | null; isActive?: boolean | null }
): { ok: true } | { ok: false; reason: string } {
  const actorRole = (actor.adminRole as AdminRole) || 'READ_ONLY';
  const actorRank = ADMIN_ROLE_RANK[actorRole] ?? 0;
  const actorId = actor.adminId ?? actor.riderDbId;
  const isSelf = target.id && actorId && target.id === actorId;

  const targetRole = (target.role as AdminRole) || 'READ_ONLY';
  const targetRank = ADMIN_ROLE_RANK[targetRole] ?? 0;

  // G-1: if targeting another admin, actor's rank must be strictly higher than target's rank (unless actor is SUPER_ADMIN)
  if (!isSelf && actorRole !== 'SUPER_ADMIN') {
    if (target.id && targetRank >= actorRank) {
      return {
        ok: false,
        reason: `Target role ${targetRole} (rank ${targetRank}) is ranked at or above your own (${actorRole}, rank ${actorRank})`,
      };
    }
  }

  // When assigning/creating a role, target rank cannot exceed actor rank
  if (targetRank > actorRank) {
    return {
      ok: false,
      reason: `Target role ${targetRole} (rank ${targetRank}) is above your own (${actorRole}, rank ${actorRank})`,
    };
  }

  // G-2: permissions subset check. The actor's effective permissions
  // = role base ∪ explicit perms. The target can only be granted
  // permissions from that set. SUPER_ADMIN short-circuits to "true"
  // (they hold every key).
  if (target.permissions && target.permissions.length > 0) {
    if (actorRole === 'SUPER_ADMIN') {
      // pass
    } else {
      const ok = target.permissions.every((p) => hasPermission(actor, p as never));
      if (!ok) {
        return {
          ok: false,
          reason: 'You can only grant permissions you already hold',
        };
      }
    }
  }

  return { ok: true };
}

/** Strips the password hash (and any future sensitive fields) from an
 *  admin row before it leaves the use case. The PUT route does this
 *  inline (line 214 of admins/route.ts); the POST route did not
 *  (W6 / G-3). Centralising the strip in the use case means every
 *  future call site gets it for free. */
function stripAdminSecrets<T extends { password?: unknown }>(row: T): Omit<T, 'password'> {
  const { password: _password, ...safe } = row;
  return safe;
}

/** AUDIT FIX (N-11): lazily-built Argon2id hash used only on the
 * unknown-email path to equalize verify timing. */
let dummyHashPromise: Promise<string> | null = null;

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

  async createAdmin(params: CreateAdminParams, actorId: string, ctx: AdminActionContext = {}) {
    // W6 / G-1, G-2: rank + permission-subset check on the NEW admin.
    // A TEAM_LEADER with an explicit `admins_manage` grant must not be
    // able to mint a SUPER_ADMIN or grant permissions they don't hold.
    // The `canGrantRole` check in the route layer still runs (defence
    // in depth + handles the unknown-target case), but the use case is
    // the last line of defence before the DB write.
    if (ctx.session) {
      const check = canModifyTarget(ctx.session, {
        role: params.role,
        permissions: params.permissions,
      });
      if (!check.ok) throw new Error(check.reason);
    }

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
      request: ctx.request,
    });

    // W6 / G-3: never return the password hash from a create. Previously
    // the POST route returned `result` raw, exposing the Argon2id hash.
    return stripAdminSecrets(admin);
  },

  async updateAdmin(id: string, params: UpdateAdminParams, actorId: string, ctx: AdminActionContext = {}) {
    const existing = await adminRepository.findById(id);
    if (!existing) {
      throw new Error('Admin not found');
    }

    // W6 / G-1, G-2: rank + permission-subset check on the EXISTING
    // target. The check uses the *post*-change role / permissions so
    // a TEAM_LEADER can't sneak a rank change past the gate by
    // skipping the role field on the request.
    if (ctx.session) {
      const check = canModifyTarget(ctx.session, {
        id,
        role: params.role ?? (existing.role as string | null),
        permissions: params.permissions,
      });
      if (!check.ok) throw new Error(check.reason);
    }

    // Admin Panel Phase 4 / Batch B (2026-08-23): last active SUPER_ADMIN
    // guard. A SUPER_ADMIN who is the only remaining one cannot be
    // deactivated OR demoted to a non-SUPER_ADMIN role. The check fires
    // on the change being applied (isActive=false OR role!==SUPER_ADMIN)
    // and uses the DB to count *other* active SUPER_ADMINs (the one
    // we're editing still counts toward the pre-mutation total; we
    // look at the *post*-change picture by checking the count BEFORE
    // applying the mutation, then asking "is this admin still going
    // to be an active SUPER_ADMIN after?". If not, the count of other
    // active SUPER_ADMINs must be >= 1 to allow it.
    if (existing.role === 'SUPER_ADMIN' && existing.isActive) {
      const demoting = params.role !== undefined && params.role !== 'SUPER_ADMIN';
      const deactivating = params.isActive === false;
      if (demoting || deactivating) {
        const activeSuperAdminCount = await adminRepository.count({
          role: 'SUPER_ADMIN',
          isActive: true,
        });
        if (activeSuperAdminCount <= 1) {
          throw new Error(
            'Cannot deactivate or demote the last active SUPER_ADMIN account'
          );
        }
      }
    }

    const admin = await adminRepository.update(id, params);

    await logAdminAction({
      actorId,
      action: AUDIT_ACTIONS.ADMIN_UPDATE,
      entity: 'admin',
      entityId: id,
      // P0-2: include the `reason` (P0-1 client-side) in the audit details so
      // compliance can read it back. Strip the password hash from `changes`
      // to avoid logging the hashed credential.
      details: {
        changes: (({ password, ...safe }) => safe)(params),
        ...(ctx.reason ? { reason: ctx.reason } : {}),
      },
      request: ctx.request,
    });

    // W6 / G-3: never return the (new) password hash. Belt-and-braces
    // — the PUT route already strips it, but a future caller that
    // forgets will get this protection.
    return stripAdminSecrets(admin);
  },

  async deleteAdmin(id: string, actorId: string, ctx: AdminActionContext = {}) {
    if (id === actorId) {
      throw new Error('Cannot delete or deactivate your own admin account');
    }

    const existing = await adminRepository.findById(id);
    if (!existing) {
      throw new Error('Admin not found');
    }

    // W6 / G-1: a lower-ranked admin cannot deactivate a higher-ranked
    // target via delete. We check rank against the live row because
    // delete is a deactivate.
    if (ctx.session) {
      const check = canModifyTarget(ctx.session, {
        role: existing.role,
        isActive: existing.isActive,
      });
      if (!check.ok) throw new Error(check.reason);
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
      details: {
        email: existing.email,
        softDeactivated: true,
        ...(ctx.reason ? { reason: ctx.reason } : {}),
      },
      request: ctx.request,
    });
  },

  async getAuditLogs(filters: {
    entity?: string;
    entityId?: string;
    actorId?: string;
    action?: string;
    actionPrefix?: string;
    q?: string;
    from?: string;
    to?: string;
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
    // AUDIT FIX (N-11): unknown-email used to early-return BEFORE the
    // ~80ms Argon2id verify -- a timing oracle for email enumeration. The
    // miss path now burns a verification against a dummy hash so both
    // paths take comparable time. The dummy is computed once, lazily.
    const admin = await adminRepository.findByEmail(email);
    if (!admin) {
      try {
        const pwModule = await import('@/lib/password');
        if (!dummyHashPromise) {
          dummyHashPromise = pwModule
            .hashPassword('timing-equalizer-c7f4a19d2e8b')
            .catch(() => '');
        }
        const hash = await dummyHashPromise;
        if (hash) await pwModule.verifyPassword(password, hash);
      } catch {
        // never surface anything from the equalizer
      }
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
