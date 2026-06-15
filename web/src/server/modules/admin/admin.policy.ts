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
import { hasPermission, type Permission } from '@/lib/auth';
import { errors } from '@/lib/api-response';

export class AdminAuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
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
 * Require that the request has a valid admin session.
 * Throws AdminAuthError if not authenticated.
 */
export async function requireAdminSession(request?: NextRequest) {
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
export async function requirePermission(
  permission: Permission,
  request?: NextRequest
) {
  const session = await getAdminSession(request);
  if (!session) {
    throw new AdminAuthError('Admin authentication required');
  }

  // Super Admin has all permissions
  if (session.adminRole === 'SUPER_ADMIN') {
    return session;
  }

  // Check the specific permission
  const role = session.adminRole || '';
  if (!hasPermission(role, permission)) {
    throw new AdminForbiddenError(
      `Insufficient permissions: requires '${permission}'`
    );
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
  handler: (req: NextRequest, session: any) => Promise<Response>
) {
  return async (req: NextRequest) => {
    try {
      const session = await requirePermission(permission, req);
      return await handler(req, session);
    } catch (err) {
      if (err instanceof AdminAuthError) {
        return errors.unauthorized(err.message);
      }
      if (err instanceof AdminForbiddenError) {
        return errors.forbidden(err.message);
      }
      throw err;
    }
  };
}

/**
 * Admin-only version (any active admin).
 */
export function withAdmin(
  handler: (req: NextRequest, session: any) => Promise<Response>
) {
  return async (req: NextRequest) => {
    try {
      const session = await requireAdminSession(req);
      return await handler(req, session);
    } catch (err) {
      if (err instanceof AdminAuthError) {
        return errors.unauthorized(err.message);
      }
      throw err;
    }
  };
}

/**
 * Create an audit log entry for a sensitive admin action.
 * Non-blocking — failures are logged but don't abort the request.
 */
import { createAuditLog } from '@/lib/audit-log';

export async function logAdminAction(params: {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog({
    actorId: params.actorId,
    actorType: 'ADMIN',
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    details: params.details ? JSON.stringify(params.details) : undefined,
  });
}
