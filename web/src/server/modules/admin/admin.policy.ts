/**
 * Admin Policy Enforcement
 *
 * Provides helper functions for RBAC enforcement in admin route handlers.
 * Every sensitive admin action should pass through one of these wrappers.
 *
 * Usage:
 *   const session = await requirePermission('kyc_approve');
 *   // session is guaranteed to be non-null after this call
 */

import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { hasPermission, type Permission, type SessionPayload } from '@/lib/auth';
import { errors } from '@/lib/api-response';

export class AdminAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

export class AdminForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminForbiddenError';
  }
}

/**
 * Require that the request has a valid admin session, and optionally a required permission.
 * Throws AdminAuthError if not authenticated, or AdminForbiddenError if lacking permission.
 */
export async function requireAdminSession(request?: NextRequest, permission?: Permission) {
  if (permission) {
    return requirePermission(permission, request);
  }
  const session = await getAdminSession(request);
  if (!session) {
    throw new AdminAuthError('Admin authentication required');
  }
  return session;
}

/**
 * Require admin authentication AND a specific permission.
 * Throws AdminForbiddenError if the admin lacks the required permission.
 */
export async function requirePermission(permission: Permission, request?: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) {
    throw new AdminAuthError('Admin authentication required');
  }

  // Super Admin has all permissions
  if (session.adminRole === 'SUPER_ADMIN') {
    return session;
  }

  // Check the specific permission
  // AUDIT FIX (N-5): pass the SESSION OBJECT. The string form dropped
  // per-admin `adminPermissions` — explicit grants were ignored and
  // revocations bypassed on every route using this policy helper.
  if (!hasPermission(session, permission)) {
    throw new AdminForbiddenError(`Insufficient permissions: requires '${permission}'`);
  }

  return session;
}

/**
 * Higher-order function that wraps an API route handler with RBAC enforcement.
 *
 * Usage:
 *   export const POST = withPermission('kyc_approve', async (req, session) => {
 *     // ... route logic here, session is guaranteed
 *   });
 */
export function withPermission(
  permission: Permission,
  handler: (req: NextRequest, session: SessionPayload) => Promise<Response>
) {
  return async (req: NextRequest) => {
    try {
      const session = await requirePermission(permission, req);
      return await handler(req, session);
    } catch (err) {
      if (err instanceof AdminAuthError) {
        return errors.unauthorized((err instanceof Error ? err.message : String(err)));
      }
      if (err instanceof AdminForbiddenError) {
        return errors.forbidden((err instanceof Error ? err.message : String(err)));
      }
      throw err;
    }
  };
}

/**
 * Admin-only version (any active admin).
 */
export function withAdmin(handler: (req: NextRequest, session: SessionPayload) => Promise<Response>) {
  return async (req: NextRequest) => {
    try {
      const session = await requireAdminSession(req);
      return await handler(req, session);
    } catch (err) {
      if (err instanceof AdminAuthError) {
        return errors.unauthorized((err instanceof Error ? err.message : String(err)));
      }
      throw err;
    }
  };
}

/**
 * Create an audit log entry for a sensitive admin action.
 * Non-blocking — failures are logged but don't abort the request.
 *
 * P0-2 (ADMIN_ADMIN_USERS_AUDIT_2026-08-24): when a `request` is provided,
 * the audit entry is enriched with the actor's IP, user-agent, and the
 * server-side session id (from the cookie/JWT). The enrichment is
 * opt-in so callers that don't have a request (e.g. a cron job) can
 * still call this without fake data.
 */
import { createAuditLog } from '@/lib/audit-log';

/**
 * Extract a best-effort IP address and user-agent from a request, taking
 * the standard `x-forwarded-for` chain (first hop is the original client)
 * and the standard `user-agent` header. Returns nulls for either if the
 * headers are missing (e.g. server-to-server test calls).
 */
export function extractRequestContext(req: NextRequest | undefined | null): {
  ip: string | null;
  userAgent: string | null;
} {
  if (!req) return { ip: null, userAgent: null };
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd ? fwd.split(',')[0].trim() : req.headers.get('x-real-ip') || null;
  const userAgent = req.headers.get('user-agent') || null;
  return { ip, userAgent };
}

export async function logAdminAction(params: {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  request?: NextRequest;
}): Promise<void> {
  // P0-2: enrich the audit log entry with IP / UA when the request is
  // available. This is the compliance-investigation trail — "who
  // deactivated admin X, and from where?" must be answerable from the
  // audit log alone. The `actorSessionId` field is intentionally not
  // included: the JWT does not currently carry a `jti`, so we have no
  // stable per-session id to record. Add when JWTs are re-minted with
  // a `jti` claim.
  const ctx = params.request ? extractRequestContext(params.request) : { ip: null, userAgent: null };
  const enrichedDetails: Record<string, unknown> = {
    ...(params.details ?? {}),
    ...(ctx.ip ? { actorIp: ctx.ip } : {}),
    ...(ctx.userAgent ? { actorUserAgent: ctx.userAgent } : {}),
  };

  await createAuditLog({
    actorId: params.actorId,
    actorType: 'ADMIN',
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    details: Object.keys(enrichedDetails).length > 0 ? JSON.stringify(enrichedDetails) : undefined,
  });
}
