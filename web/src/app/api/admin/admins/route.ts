import { NextRequest } from 'next/server';
import type { ZodIssue } from 'zod';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { hashPassword } from '@/lib/password';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { parsePositiveInt } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';
import type { AdminRole } from '@/server/modules/admin/admin.types';
import { ADMIN_ROLE_RANK } from '@/server/modules/admin/admin.types';
import type { UpdateAdminParams } from '@/server/modules/admin/admin.repository';
import { createAdminSchema, updateAdminSchema } from '@/lib/validators/admin';

// P1-2 (2026-08-05 ops audit): password hashing is Argon2id (~100ms CPU per
// hash). A scripted loop of PUTs would pin the event loop. 30/min/admin,
// fail-closed — the endpoint is admin-only so an outage must deny, not open.
const ADMIN_MUTATION_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 30,
  failClosed: true,
} as const;

/**
 * P1-1 (2026-08-05 ops audit): privilege-escalation guard for role
 * assignment. An admin may only create/assign a role ranked AT or BELOW
 * their own — otherwise any OPERATIONS_ADMIN could mint a SUPER_ADMIN.
 */
function canGrantRole(actorRole: string | undefined, targetRole: AdminRole): boolean {
  const actorRank = ADMIN_ROLE_RANK[(actorRole as AdminRole) || 'READ_ONLY'] ?? 0;
  const targetRank = ADMIN_ROLE_RANK[targetRole] ?? 0;
  return targetRank > 0 && targetRank <= actorRank;
}

/** P2-1: full Zod issue list, not just the first error message. */
function validationMessage(issues: ZodIssue[]): string {
  return issues
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'admins_manage')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const search = url.searchParams.get('search') || '';
    const role = url.searchParams.get('role') || '';
    const isActive = url.searchParams.get('isActive');
    // PR-4b (13th audit P0-6): NaN-safe pagination.
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

    const result = await adminUseCases.listAdmins({
      role,
      isActive: isActive !== null && isActive !== '' ? isActive === 'true' : undefined,
      search,
      page,
      limit,
    });
    return withCacheHeaders(success(result.admins, undefined, 200, result.pagination), 10);
  } catch (error) {
    logger.error('GET /api/admin/admins error:', error);
    return errors.internal('Failed to fetch admins');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'admins_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = createAdminSchema.safeParse(body);
    if (!validation.success) {
      return errors.validation(validationMessage(validation.error.issues));
    }

    const { name, email, password, role, permissions: rawPermissions } = validation.data;

    // P1-1: no privilege escalation — an OPERATIONS_ADMIN cannot create a
    // SUPER_ADMIN (or any role ranked above themselves).
    if (!canGrantRole(session.adminRole, role as AdminRole)) {
      return adminForbidden('Cannot create an admin with a role ranked above your own');
    }

    // P1-2: rate limit — password hashing (Argon2id) is CPU-bound; the same
    // 30/min/admin budget applies to POST as to PUT.
    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    const rateLimit = await checkRateLimit(`admin:admins:create:${actorId}`, {
      ...ADMIN_MUTATION_RATE_LIMIT,
    });
    if (!rateLimit.allowed) {
      return errors.tooManyRequests('Too many admin updates — try again shortly');
    }

    // Validate permissions against known keys (server-side allowlist)
    const { PERMISSION_DESCRIPTORS } = await import('@/lib/permissions');
    const validPermissionKeys = PERMISSION_DESCRIPTORS.map(p => p.key) as string[];
    const permissions = (rawPermissions ?? []).filter(
      (p: unknown) => typeof p === 'string' && validPermissionKeys.includes(p)
    );

    // G-2: subset-of-granter on create — non-SUPER_ADMINs can only grant permissions they hold
    if (session.adminRole !== 'SUPER_ADMIN') {
      const unheld = permissions.filter(p => !hasPermission(session, p as any));
      if (unheld.length > 0) {
        await createAuditLog({
          actorId,
          actorType: 'ADMIN',
          action: 'SECURITY_VIOLATION',
          entity: 'admin',
          details: { reason: 'Attempted privilege escalation via unheld permissions on create', unheld },
        });
        return adminForbidden(`Cannot grant permissions you do not possess: ${unheld.join(', ')}`);
      }
    }

    const result = await adminUseCases.createAdmin(
      { name, email, password, role: role as AdminRole, permissions },
      actorId,
      { request: req, session }
    );

    // W6 / G-3: strip password hash in return
    const { password: _pw, ...safe } = result as { password?: string } & Record<string, unknown>;
    return success(safe, 'Admin created', 201);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('POST /api/admin/admins error:', error);
    if ((err instanceof Error ? err.message : String(err)).includes('already exists')) return errors.conflict((err instanceof Error ? err.message : String(err)));
    return errors.internal('Failed to create admin');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'admins_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = updateAdminSchema.safeParse(body);
    if (!validation.success) {
      return errors.validation(validationMessage(validation.error.issues));
    }

    const { id, password, currentPassword, email, name, role, permissions, isActive, reason } =
      validation.data;

    // P0-3 (2026-08-05 ops audit): self-update guard. A SUPER_ADMIN must not
    // be able to lock themselves out or silently demote/deactivate their own
    // account via a CSRF'd/stolen cookie. Only name/email are self-editable.
    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    const isSelf = id === actorId;
    if (isSelf && (role || permissions || isActive !== undefined)) {
      if (isActive === false) {
        return errors.badRequest('Use the logout endpoint to deactivate your session');
      }
      return errors.badRequest('Ask another SUPER_ADMIN to change your role or permissions');
    }

    // G-1: Actor-target hierarchy rank check
    const target = await adminUseCases.getAdmin(id);
    if (!target) {
      return errors.notFound('Admin not found');
    }

    const actorRole = (session.adminRole as AdminRole) || 'READ_ONLY';
    const actorRank = ADMIN_ROLE_RANK[actorRole] ?? 0;
    const targetRole = (target.role as AdminRole) || 'READ_ONLY';
    const targetRank = ADMIN_ROLE_RANK[targetRole] ?? 0;

    // G-1: if editing another admin, actor's rank must be strictly higher than target's rank,
    // unless actor is SUPER_ADMIN
    if (!isSelf && actorRole !== 'SUPER_ADMIN') {
      if (targetRank >= actorRank) {
        await createAuditLog({
          actorId,
          actorType: 'ADMIN',
          action: 'SECURITY_VIOLATION',
          entity: 'admin',
          entityId: id,
          details: {
            reason: 'Attempted mutation of admin with role ranked at or above own role',
            actorRole,
            targetRole,
          },
        });
        return adminForbidden(
          `Cannot modify an admin with role ${targetRole} (rank ${targetRank}) ranked at or above your own (${actorRole}, rank ${actorRank})`
        );
      }
    }

    // P1-1: same no-escalation rule applies to role changes.
    if (role && !canGrantRole(session.adminRole, role as AdminRole)) {
      return adminForbidden('Cannot assign a role ranked above your own');
    }

    // P0-1 (ADMIN_ADMIN_USERS_AUDIT_2026-08-24): require a `reason` when
    // deactivating any admin. Activations and other edits are unchanged. The
    // min(3) length is enforced by the Zod schema; the route enforces the
    // deactivation branch.
    if (isActive === false && !reason) {
      return errors.badRequest('A reason is required to deactivate an admin (P0-1)');
    }

    // P1-2: rate limit — hashing on every password change is CPU-bound.
    const rateLimit = await checkRateLimit(`admin:admins:update:${actorId}`, {
      ...ADMIN_MUTATION_RATE_LIMIT,
    });
    if (!rateLimit.allowed) {
      return errors.tooManyRequests('Too many admin updates — try again shortly');
    }

    // P0-3: any password change requires the ACTOR's current password
    // (re-authentication), verified against the actor's own hash — NOT the
    // target's. Verifying the target's hash would deadlock password recovery
    // (only the victim knows their password) and breaks the admin-reset flow.
    if (password) {
      if (!currentPassword) {
        return errors.badRequest('currentPassword is required to change the password');
      }
      const actor = await adminUseCases.getAdmin(actorId);
      const { verifyPassword } = await import('@/lib/password');
      const check = await verifyPassword(currentPassword, actor.password);
      if (!check.valid) {
        return errors.badRequest('currentPassword is incorrect');
      }
    }

    // Validate permissions against known keys (server-side allowlist)
    let sanitizedPermissions: string[] | undefined = undefined;
    if (permissions) {
      const { PERMISSION_DESCRIPTORS } = await import('@/lib/permissions');
      const validPermissionKeys = PERMISSION_DESCRIPTORS.map(p => p.key) as string[];
      sanitizedPermissions = permissions.filter(
        (p: unknown) => typeof p === 'string' && validPermissionKeys.includes(p)
      );

      // G-2: subset-of-granter rule — non-SUPER_ADMINs can only grant permissions they currently possess
      if (session.adminRole !== 'SUPER_ADMIN') {
        const unheld = sanitizedPermissions.filter(p => !hasPermission(session, p as any));
        if (unheld.length > 0) {
          await createAuditLog({
            actorId,
            actorType: 'ADMIN',
            action: 'SECURITY_VIOLATION',
            entity: 'admin',
            entityId: id,
            details: { reason: 'Attempted privilege escalation via unheld permissions', unheld },
          });
          return adminForbidden(`Cannot grant permissions you do not possess: ${unheld.join(', ')}`);
        }
      }
    }

    const updateData: UpdateAdminParams = {
      email,
      name,
      role: role as AdminRole | undefined,
      permissions: sanitizedPermissions,
      isActive,
    };
    if (password) {
      updateData.password = await hashPassword(password);
    }

    const admin = await adminUseCases.updateAdmin(id, updateData, actorId, {
      reason,
      request: req,
      session,
    });
    // Never return the password hash to the client (same rule as /me).
    // W6 / G-3: the use case already strips it now; this is belt-and-braces
    // for any future call site that forgets.
    const { password: _pw, ...safe } = admin as { password?: string } & Record<string, unknown>;
    return success(safe);
  } catch (error: unknown) {
    logger.error('PUT /api/admin/admins error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('not found')) return errors.notFound(msg);
    if (
      msg.includes('is above your own') ||
      msg.includes('ranked at or above') ||
      msg.includes('only grant permissions')
    ) {
      return adminForbidden(msg);
    }
    if (msg.includes('last active SUPER_ADMIN')) return errors.badRequest(msg);
    return errors.internal('Failed to update admin');
  }
}
