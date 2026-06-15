/**
 * RBAC core for admin roles and permissions (PR-A)
 * Expanded roles: SUPER_ADMIN, OPERATIONS_ADMIN, KYC_REVIEWER, FINANCE_ADMIN, SUPPORT_AGENT, HUB_MANAGER, FLEET_MANAGER, READ_ONLY
 */

import crypto from 'crypto';
import { env } from './env';

export const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'OPERATIONS_ADMIN',
  'KYC_REVIEWER',
  'FINANCE_ADMIN',
  'SUPPORT_AGENT',
  'HUB_MANAGER',
  'FLEET_MANAGER',
  'TEAM_LEADER',
  'READ_ONLY',
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

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

const ACTUAL_SECRET = env.JWT_SECRET;

// Create a signed JWT session token
export function createSessionToken(payload: {
  riderId: string;
  riderDbId: string;
  phone: string;
  role: string;
  adminRole?: string;
  adminId?: string;
  adminPermissions?: string[];
}): string {
  // Validate payload structure
  if (!payload.riderId || !payload.riderDbId || !payload.phone) {
    throw new Error('Invalid payload: Missing required fields');
  }

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadStr = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Date.now(),
      exp: Date.now() + SESSION_COOKIE_OPTIONS.maxAge * 1000,
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', ACTUAL_SECRET)
    .update(`${header}.${payloadStr}`)
    .digest('base64url');

  return `${header}.${payloadStr}.${signature}`;
}

// Verify and decode a session token
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    // Validate token format
    if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
      return null;
    }

    const [header, payload, signature] = token.split('.');

    // Validate base64url encoding
    try {
      // Try to decode to check if it's valid base64url
      Buffer.from(header, 'base64url');
      Buffer.from(payload, 'base64url');
    } catch {
      return null;
    }

    const expectedSignature = crypto
      .createHmac('sha256', ACTUAL_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

    // Check if token is expired
    if (decoded.exp && Date.now() > decoded.exp) {
      return null;
    }

    // Validate required fields exist
    if (!decoded.riderId || !decoded.riderDbId || !decoded.phone) {
      return null;
    }

    return {
      riderId: decoded.riderId,
      riderDbId: decoded.riderDbId,
      phone: decoded.phone,
      role: decoded.role,
      adminRole: decoded.adminRole,
      adminId: decoded.adminId,
      adminPermissions: decoded.adminPermissions,
    };
  } catch (err) {
    console.error('[Auth] Token verification failed:', err);
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
  adminPermissions?: string[]; // Array of allowed permission keys
};

// Comprehensive list of all available permissions with labels and categories
export const PERMISSION_DESCRIPTORS = [
  { key: 'riders_view', label: 'View Riders', category: 'Riders' },
  { key: 'riders_create', label: 'Create Riders', category: 'Riders' },
  { key: 'riders_update', label: 'Update Riders', category: 'Riders' },
  { key: 'riders_delete', label: 'Delete Riders', category: 'Riders' },
  { key: 'kyc_view', label: 'View KYC', category: 'Riders' },
  { key: 'kyc_approve', label: 'Approve KYC', category: 'Riders' },
  { key: 'kyc_reject', label: 'Reject KYC', category: 'Riders' },

  { key: 'vehicles_view', label: 'View Vehicles', category: 'Vehicles' },
  { key: 'vehicles_create', label: 'Create Vehicles', category: 'Vehicles' },
  { key: 'vehicles_update', label: 'Update Vehicles', category: 'Vehicles' },
  { key: 'vehicles_delete', label: 'Delete Vehicles', category: 'Vehicles' },
  { key: 'hubs_manage', label: 'Manage Hubs', category: 'Vehicles' },

  { key: 'transactions_view', label: 'View Transactions', category: 'Finance' },
  { key: 'transactions_approve', label: 'Approve Top-ups', category: 'Finance' },
  { key: 'transactions_reject', label: 'Reject Top-ups', category: 'Finance' },
  { key: 'transactions_manage', label: 'Financial Management', category: 'Finance' },

  { key: 'tickets_view', label: 'View Tickets', category: 'Support' },
  { key: 'tickets_resolve', label: 'Resolve Tickets', category: 'Support' },
  { key: 'tickets_manage', label: 'Full Ticket Access', category: 'Support' },
  { key: 'notifications_manage', label: 'Send Notifications', category: 'Support' },

  { key: 'analytics_view', label: 'View Analytics', category: 'System' },
  { key: 'admins_manage', label: 'Manage Admin Users', category: 'System' },
  { key: 'plans_manage', label: 'Manage Rental Plans', category: 'System' },
  { key: 'settings_manage', label: 'System Settings', category: 'System' },
  { key: 'legal_manage', label: 'Legal Documents', category: 'System' },
  { key: 'faq_manage', label: 'FAQ Management', category: 'System' },

  { key: 'referrals_view', label: 'View Referrals', category: 'Marketing' },
  { key: 'rewards_manage', label: 'Manage Rewards', category: 'Marketing' },
  { key: 'offers_manage', label: 'Manage Offers/Coupons', category: 'Marketing' },
  { key: 'device_tracking_view', label: 'View Device Tracking (Calls/GPS)', category: 'Security' },
  {
    key: 'device_remote_control',
    label: 'Remote Device Control (Lock/Wipe)',
    category: 'Security',
  },
] as const;

// Permissions mapping (expanded for new roles)
type PermissionList = AdminRole[];

// Properly-typed permissions mapping
const PERMISSIONS_MAP: Record<string, PermissionList> = {
  // Riders
  riders_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER', 'FINANCE_ADMIN', 'SUPPORT_AGENT', 'HUB_MANAGER', 'FLEET_MANAGER'],
  riders_create: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  riders_update: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FLEET_MANAGER'],
  riders_delete: ['SUPER_ADMIN'],

  // KYC
  kyc_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER'],
  kyc_approve: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER'],
  kyc_reject: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER'],

  // Vehicles
  vehicles_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FLEET_MANAGER', 'HUB_MANAGER'],
  vehicles_create: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FLEET_MANAGER'],
  vehicles_update: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FLEET_MANAGER'],
  vehicles_delete: ['SUPER_ADMIN'],

  // Transactions
  transactions_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN'],
  transactions_approve: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN'],
  transactions_reject: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN'],
  transactions_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN'],

  // Tickets
  tickets_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT'],
  tickets_resolve: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT'],
  tickets_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT'],

  // Analytics
  analytics_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'FLEET_MANAGER', 'HUB_MANAGER'],

  // Admin operations
  admins_manage: ['SUPER_ADMIN'],
  tl_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  team_leaders_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  plans_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  notifications_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT'],
  offers_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  settings_manage: ['SUPER_ADMIN'],
  legal_manage: ['SUPER_ADMIN'],
  faq_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT'],

  // Hubs
  hubs_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'HUB_MANAGER'],

  // Referrals & Rewards
  referrals_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT'],
  rewards_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  device_tracking_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FLEET_MANAGER'],
  device_remote_control: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
} as const;

// Export as readonly for immutability
export const PERMISSIONS = Object.freeze(PERMISSIONS_MAP);

export type Permission = keyof typeof PERMISSIONS;

/**
 * Checks if a user has a specific permission.
 * Supports both role-based defaults and user-specific overrides.
 */
export function hasPermission(
  roleOrSession: string | SessionPayload,
  permission: Permission
): boolean {
  // If we have a session, check dynamic overrides first
  if (typeof roleOrSession === 'object' && roleOrSession !== null) {
    const session = roleOrSession as any;
    const role = session.adminRole || session.role || '';

    // Super Admin always has full access
    if (role === 'SUPER_ADMIN') return true;

    // Check specific user overrides if they exist
    const perms = session.adminPermissions || session.permissions;
    if (perms && Array.isArray(perms) && perms.length > 0) {
      return perms.includes(permission);
    }

    // Fall back to role-based check
    return hasPermission(role, permission);
  }

  // Pure role-based check
  const role = roleOrSession;
  if (role === 'SUPER_ADMIN') return permission in PERMISSIONS;

  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role as AdminRole);
}

export function getPermissionsForRole(role: string): Permission[] {
  const adminRole = role as AdminRole;
  if (adminRole === 'SUPER_ADMIN') {
    return Object.keys(PERMISSIONS) as Permission[];
  }
  return (Object.keys(PERMISSIONS) as Permission[]).filter((perm) =>
    PERMISSIONS[perm].includes(adminRole)
  );
}
