/**
 * RBAC core for admin roles and permissions (PR-A)
 * Expanded roles: SUPER_ADMIN, ADMIN, MANAGER, FLEET_MANAGER, TEAM_LEADER
 */

import crypto from 'crypto';

export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER'] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

// Session cookie configuration
export const SESSION_COOKIE_NAME = 'voltium-session';
export const ADMIN_SESSION_COOKIE_NAME = 'voltium-admin-session';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  console.warn('⚠️  JWT_SECRET not set — using INSECURE dev fallback. DO NOT deploy to production!');
}
const ACTUAL_SECRET = JWT_SECRET || 'voltfleet-dev-secret-key-INSECURE-DO-NOT-PROD';

// Create a signed JWT session token
export function createSessionToken(payload: {
  riderId: string;
  riderDbId: string;
  phone: string;
  role: string;
  adminRole?: string;
  adminId?: string;
}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadStr = Buffer.from(JSON.stringify({
    ...payload,
    iat: Date.now(),
    exp: Date.now() + SESSION_COOKIE_OPTIONS.maxAge * 1000,
  })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', ACTUAL_SECRET)
    .update(`${header}.${payloadStr}`)
    .digest('base64url');
  
  return `${header}.${payloadStr}.${signature}`;
}

// Verify and decode a session token
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const [header, payload, signature] = token.split('.');
    
    const expectedSignature = crypto
      .createHmac('sha256', ACTUAL_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    
    if (decoded.exp && Date.now() > decoded.exp) {
      return null;
    }
    
    return {
      riderId: decoded.riderId,
      riderDbId: decoded.riderDbId,
      phone: decoded.phone,
      role: decoded.role,
      adminRole: decoded.adminRole,
      adminId: decoded.adminId,
    };
  } catch {
    return null;
  }
}

export type SessionPayload = {
  riderId: string;
  riderDbId: string;
  phone: string;
  role: string;
  adminRole?: string;
  adminId?: string;
};

// Permissions mapping (expanded for new roles)
type PermissionList = AdminRole[];

// Properly-typed permissions mapping
const PERMISSIONS_MAP: Record<string, PermissionList> = {
  // Riders
  riders_view: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER'],
  riders_create: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEADER'],
  riders_update: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FLEET_MANAGER'],
  riders_delete: ['SUPER_ADMIN', 'ADMIN'],

  // KYC
  kyc_view: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEADER'],
  kyc_approve: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER'],
  kyc_reject: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER'],

  // Vehicles
  vehicles_view: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FLEET_MANAGER'],
  vehicles_create: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FLEET_MANAGER'],
  vehicles_update: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FLEET_MANAGER'],
  vehicles_delete: ['SUPER_ADMIN', 'ADMIN'],

  // Transactions
  transactions_view: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  transactions_approve: ['SUPER_ADMIN', 'ADMIN'],
  transactions_reject: ['SUPER_ADMIN', 'ADMIN'],

  // Tickets
  tickets_view: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEADER'],
  tickets_resolve: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEADER'],

  // Analytics
  analytics_view: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FLEET_MANAGER'],

  // Admin operations
  admins_manage: ['SUPER_ADMIN', 'ADMIN'],
  tl_manage: ['SUPER_ADMIN', 'ADMIN'],
  plans_manage: ['SUPER_ADMIN', 'ADMIN'],
  notifications_manage: ['SUPER_ADMIN', 'ADMIN'],
  offers_manage: ['SUPER_ADMIN', 'ADMIN'],
  settings_manage: ['SUPER_ADMIN', 'ADMIN'],
  legal_manage: ['SUPER_ADMIN', 'ADMIN'],
  faq_manage: ['SUPER_ADMIN', 'ADMIN'],

  // Hubs
  hubs_manage: ['SUPER_ADMIN', 'ADMIN'],

  // Referrals & Rewards
  referrals_view: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  rewards_manage: ['SUPER_ADMIN', 'ADMIN'],
} as const;

// Export as readonly for immutability
export const PERMISSIONS = Object.freeze(PERMISSIONS_MAP);

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: string, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role as AdminRole);
}

export function getPermissionsForRole(role: string): Permission[] {
  const adminRole = role as AdminRole;
  return (Object.keys(PERMISSIONS) as Permission[]).filter((perm) =>
    PERMISSIONS[perm].includes(adminRole)
  );
}
