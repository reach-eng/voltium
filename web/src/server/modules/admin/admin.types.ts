/**
 * Admin Module Types
 *
 * Defines the admin roles, permission system, and action types.
 * Role names MUST match auth.ts PERMISSIONS_MAP for RBAC to work.
 */

// ---------------------------------------------------------------------------
// Admin Roles — MUST match auth.ts ADMIN_ROLES and PERMISSIONS_MAP
// ---------------------------------------------------------------------------

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OPERATIONS_ADMIN = 'OPERATIONS_ADMIN',
  KYC_REVIEWER = 'KYC_REVIEWER',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
  HUB_MANAGER = 'HUB_MANAGER',
  FLEET_MANAGER = 'FLEET_MANAGER',
  TEAM_LEADER = 'TEAM_LEADER',
  READ_ONLY = 'READ_ONLY',
}

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  [AdminRole.SUPER_ADMIN]: 'Super Admin',
  [AdminRole.OPERATIONS_ADMIN]: 'Operations Admin',
  [AdminRole.KYC_REVIEWER]: 'KYC Reviewer',
  [AdminRole.FINANCE_ADMIN]: 'Finance Admin',
  [AdminRole.SUPPORT_AGENT]: 'Support Agent',
  [AdminRole.HUB_MANAGER]: 'Hub Manager',
  [AdminRole.FLEET_MANAGER]: 'Fleet Manager',
  [AdminRole.TEAM_LEADER]: 'Team Leader',
};

export const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  [AdminRole.SUPER_ADMIN]: 'Full system access and settings management',
  [AdminRole.OPERATIONS_ADMIN]: 'General operational administration rights',
  [AdminRole.KYC_REVIEWER]: 'Dedicated KYC and guarantor approvals review',
  [AdminRole.FINANCE_ADMIN]: 'Ledger administration and top-ups approval',
  [AdminRole.SUPPORT_AGENT]: 'Rider support tickets and responses management',
  [AdminRole.HUB_MANAGER]: 'Local hub allocations and assignment rules',
  [AdminRole.FLEET_MANAGER]: 'Vehicles configuration and registration tracking',
  [AdminRole.TEAM_LEADER]: 'Team Leader responsible for field operations',
  [AdminRole.READ_ONLY]: 'Read-only access to operations dashboards',
};

// ---------------------------------------------------------------------------
// Admin Session
// ---------------------------------------------------------------------------

export interface AdminSession {
  id: string;
  email: string;
  name: string;
  role: AdminRole | string;
  permissions: string[];
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Audit Action Types
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  actorId: string;
  actorType: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  createdAt: Date;
}

export const AUDIT_ACTIONS = {
  // Auth
  ADMIN_LOGIN: 'admin.login',
  ADMIN_LOGOUT: 'admin.logout',
  ADMIN_LOGIN_FAILED: 'admin.login_failed',

  // KYC
  KYC_APPROVE: 'kyc.approve',
  KYC_REJECT: 'kyc.reject',
  KYC_VIEW: 'kyc.view',

  // Guarantor
  GUARANTOR_APPROVE: 'guarantor.approve',
  GUARANTOR_REJECT: 'guarantor.reject',

  // Wallet
  WALLET_APPROVE: 'wallet.approve',
  WALLET_REJECT: 'wallet.reject',
  WALLET_REVERSE: 'wallet.reverse',
  WALLET_ADJUST: 'wallet.adjust',

  // Deposit
  DEPOSIT_APPROVE: 'deposit.approve',
  DEPOSIT_REJECT: 'deposit.reject',
  DEPOSIT_REFUND: 'deposit.refund',
  DEPOSIT_FORFEIT: 'deposit.forfeit',

  // Rentals
  RENTAL_APPROVE_RETURN: 'rental.approve_return',
  RENTAL_REJECT_RETURN: 'rental.reject_return',
  RENTAL_SUSPEND: 'rental.suspend',
  RENTAL_REINSTATE: 'rental.reinstate',

  // Vehicles
  VEHICLE_CREATE: 'vehicle.create',
  VEHICLE_UPDATE: 'vehicle.update',
  VEHICLE_DELETE: 'vehicle.delete',

  // Riders
  RIDER_LOCK: 'rider.lock',
  RIDER_UNLOCK: 'rider.unlock',
  RIDER_UPDATE: 'rider.update',

  // Admin
  ADMIN_CREATE: 'admin.create',
  ADMIN_UPDATE: 'admin.update',
  ADMIN_DELETE: 'admin.delete',

  // System
  RECONCILIATION_RUN: 'reconciliation.run',
  SYSTEM_CONFIG_CHANGE: 'system.config_change',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
