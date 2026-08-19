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
  [AdminRole.READ_ONLY]: 'Read Only',
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

/**
 * Role hierarchy for privilege-escalation checks (P1-1, 2026-08-05 ops audit).
 *
 * An admin may only create/assign roles ranked AT or BELOW their own role.
 * Only SUPER_ADMIN (the top rank) can create or promote another SUPER_ADMIN —
 * an OPERATIONS_ADMIN could previously create a SUPER_ADMIN account by
 * passing role: 'SUPER_ADMIN' on POST /api/admin/admins.
 */
export const ADMIN_ROLE_RANK: Record<AdminRole, number> = {
  [AdminRole.READ_ONLY]: 1,
  [AdminRole.TEAM_LEADER]: 2,
  [AdminRole.HUB_MANAGER]: 3,
  [AdminRole.FLEET_MANAGER]: 3,
  [AdminRole.SUPPORT_AGENT]: 3,
  [AdminRole.KYC_REVIEWER]: 4,
  [AdminRole.FINANCE_ADMIN]: 5,
  [AdminRole.OPERATIONS_ADMIN]: 6,
  [AdminRole.SUPER_ADMIN]: 7,
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

  // Operations / Platform (2026-08-05 ops audit, P2-14). These actions were
  // already being WRITTEN by the routes — the map is documentation; the
  // AuditLog.action column is TEXT (migration 20260811000000) so every
  // dot-string persists. This section keeps the docs map in sync with the
  // code so future enum-style lookups find everything.
  MAINTENANCE_ENABLED: 'MAINTENANCE_ENABLED',
  MAINTENANCE_DISABLED: 'MAINTENANCE_DISABLED',
  FEATURE_FLAG_UPDATE: 'feature_flag.update',
  NOTIFICATION_SEND: 'notification.send',
  NOTIFICATION_SEND_ALL: 'notification.send_all',
  NOTIFICATION_SEND_BATCH: 'notification.send_batch',
  SETTINGS_UPDATE: 'settings.update',
  TICKET_CREATED_BY_ADMIN: 'ticket.created_by_admin',
  TICKET_STATUS_CHANGED: 'ticket.status_changed',
  TICKET_ASSIGNED: 'ticket.assign',
  TICKET_BULK_ACTION: 'ticket.bulk',
  INCIDENT_CREATE: 'incident.create',
  INCIDENT_UPDATE: 'incident.update',
  INCIDENT_STATUS: 'incident.status',
  TEAM_LEADER_CREATE: 'tl.create',
  TEAM_LEADER_UPDATE: 'tl.update',
  TEAM_LEADER_DELETE: 'tl.delete',
  HUB_CREATE: 'hub.create',
  HUB_UPDATE: 'hub.update',
  HUB_DELETE: 'hub.delete',
  // P2.20 (2026-08-05 rentals/vehicles/hubs audit): bulk hub ops write ONE
  // batched audit entry — distinct action strings so bulk and per-hub clicks
  // are distinguishable in the trail.
  HUB_BULK_ACTIVATE: 'hub.bulk_activate',
  HUB_BULK_DEACTIVATE: 'hub.bulk_deactivate',
  HUB_BULK_DELETE: 'hub.bulk_delete',
  SCORE_RECALCULATE: 'score.recalculate',
  REWARD_AWARD_MANUAL: 'reward.award_manual',
  SHIFT_CREATE: 'shift.create',
  SHIFT_UPDATE: 'shift.update',
  SHIFT_DELETE: 'shift.delete',
  TELEMETRY_CLEANUP: 'telemetry.cleanup',
  WALLET_TOPUP_APPROVE: 'wallet.approve_topup',
  WALLET_TOPUP_REJECT: 'wallet.reject_topup',
  WALLET_ADJUSTMENT: 'wallet.adjustment',
  TRANSACTION_APPROVE: 'transaction.approve',
  TRANSACTION_REJECT: 'transaction.reject',
  TRANSACTION_REVERSE: 'transaction.reverse',
  WALLET_RECONCILIATION_MISMATCH: 'security.reconciliation.mismatch',

  // Data Management / Backups
  BACKUP_CREATED: 'backup.created',
  BACKUP_FAILED: 'backup.failed',
  BACKUP_DOWNLOADED: 'backup.downloaded',
  RESTORE_REQUESTED: 'restore.requested',
  RESTORE_VALIDATED: 'restore.validated',
  RESTORE_STARTED: 'restore.started',
  RESTORE_COMPLETED: 'restore.completed',
  RESTORE_FAILED: 'restore.failed',
  BACKUP_SCHEDULE_UPDATED: 'backup.schedule_updated',
  BACKUP_SCHEDULE_VIEWED: 'backup.schedule_viewed',
  BACKUP_SCHEDULE_DISABLED: 'backup.schedule_disabled',
  BACKUP_SCHEDULE_TESTED: 'backup.schedule_tested',
  SCHEDULED_BACKUP_STARTED: 'backup.scheduled_started',
  SCHEDULED_BACKUP_COMPLETED: 'backup.scheduled_completed',
  SCHEDULED_BACKUP_FAILED: 'backup.scheduled_failed',
  BACKUP_RETENTION_APPLIED: 'backup.retention_applied',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
