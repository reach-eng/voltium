import { getAdminSession } from '@/lib/get-session';
import { hasPermission, type Permission } from '@/lib/auth';
import { errors } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import type { SessionPayload } from '@/lib/auth';

export type { SessionPayload };

export async function requireAdmin(): Promise<SessionPayload | null> {
  return await getAdminSession();
}

export async function requirePermission(permission: Permission): Promise<SessionPayload | null> {
  const session = await getAdminSession();
  if (!session) return null;

  if (!hasPermission(session.adminRole || '', permission)) {
    return null;
  }
  return session;
}

export function adminUnauthorized() {
  return errors.unauthorized('Admin authentication required');
}

export function adminForbidden() {
  return errors.forbidden('Insufficient permissions for this action');
}

export function parsePaginationParams(url: URL): { page: number; limit: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limitRaw = parseInt(url.searchParams.get('limit') || '20');
  const limit = Math.min(Math.max(1, limitRaw), 100);
  return { page, limit };
}
