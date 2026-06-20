/**
 * Role-Based Access Control (RBAC) definitions and utility helpers (client-safe).
 * This file is browser-safe and does NOT import database/prisma dependencies.
 */

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
  { key: 'kyc_add_field_note', label: 'Add KYC Field Notes', category: 'Riders' },
  { key: 'kyc_view_limited', label: 'View KYC (Limited)', category: 'Riders' },

  { key: 'guarantor_view_limited', label: 'View Guarantor (Limited)', category: 'Riders' },

  { key: 'vehicles_view', label: 'View Vehicles', category: 'Vehicles' },
  { key: 'vehicles_create', label: 'Create Vehicles', category: 'Vehicles' },
  { key: 'vehicles_update', label: 'Update Vehicles', category: 'Vehicles' },
  { key: 'vehicles_delete', label: 'Delete Vehicles', category: 'Vehicles' },
  { key: 'hubs_manage', label: 'Manage Hubs', category: 'Vehicles' },

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
  { key: 'device_remote_control',
    label: 'Remote Device Control (Lock/Wipe)',
    category: 'Security',
  },

  { key: 'rentals_pickup_inspection', label: 'Pickup Inspection', category: 'Rentals' },
  { key: 'rentals_return_inspection', label: 'Return Inspection', category: 'Rentals' },
  { key: 'vehicles_inspect', label: 'Inspect Vehicles', category: 'Vehicles' },

  { key: 'files_view_kyc', label: 'View KYC Files', category: 'Files' },
  { key: 'files_view_payment_proof', label: 'View Payment Proof Files', category: 'Files' },
  { key: 'files_view_support_attachment', label: 'View Support Attachments', category: 'Files' },

  { key: 'data_management_view', label: 'View Data Management', category: 'Data' },
  { key: 'data_management_backup', label: 'Create & Manage Backups', category: 'Data' },
  { key: 'data_management_restore', label: 'Restore Backups', category: 'Data' },
  { key: 'data_management_schedule', label: 'Manage Backup Schedule', category: 'Data' },
  { key: 'data_management_download', label: 'Download Backups', category: 'Data' },
  { key: 'data_management_test', label: 'Test Backup Settings', category: 'Data' },
  { key: 'incidents_manage', label: 'Manage Incidents', category: 'Support' },
  { key: 'riders_manage', label: 'Manage Riders Full', category: 'Riders' },
  { key: 'fleet_manage', label: 'Manage Fleet Full', category: 'Vehicles' },
  { key: 'impersonate_riders', label: 'Impersonate Riders', category: 'System' },
] as const;

type PermissionList = AdminRole[];

const PERMISSIONS_MAP: Record<string, PermissionList> = {
  // Riders
  riders_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER', 'FINANCE_ADMIN', 'SUPPORT_AGENT', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER'],
  riders_create: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'TEAM_LEADER'],
  riders_update: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FLEET_MANAGER'],
  riders_delete: ['SUPER_ADMIN'],

  // KYC
  kyc_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER', 'TEAM_LEADER'],
  kyc_approve: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER'],
  kyc_reject: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER'],
  kyc_add_field_note: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER', 'TEAM_LEADER'],
  kyc_view_limited: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER', 'TEAM_LEADER'],

  // Guarantor
  guarantor_view_limited: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER', 'TEAM_LEADER'],

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
  tickets_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'TEAM_LEADER'],
  tickets_resolve: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'TEAM_LEADER'],
  tickets_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'TEAM_LEADER'],

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

  // Rentals
  rentals_pickup_inspection: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER'],
  rentals_return_inspection: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER'],

  // Vehicles
  vehicles_inspect: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER'],

  // Hubs
  hubs_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'HUB_MANAGER'],

  // Referrals & Rewards
  referrals_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT'],
  rewards_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
  device_tracking_view: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FLEET_MANAGER'],
  device_remote_control: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],

  // Files
  files_view_kyc: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER'],
  files_view_payment_proof: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN'],
  files_view_support_attachment: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT'],

  // Data Management
  data_management_view: ['SUPER_ADMIN', 'READ_ONLY'],
  data_management_backup: ['SUPER_ADMIN'],
  data_management_restore: ['SUPER_ADMIN'],
  data_management_schedule: ['SUPER_ADMIN'],
  data_management_download: ['SUPER_ADMIN'],
  data_management_test: ['SUPER_ADMIN'],
  incidents_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'HUB_MANAGER', 'FLEET_MANAGER'],
  riders_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER', 'SUPPORT_AGENT', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER'],
  fleet_manage: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'HUB_MANAGER', 'FLEET_MANAGER'],
  impersonate_riders: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
} as const;

export const PERMISSIONS = Object.freeze(PERMISSIONS_MAP);

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(
  roleOrSession: string | SessionPayload,
  permission: Permission
): boolean {
  if (typeof roleOrSession === 'object' && roleOrSession !== null) {
    const session = roleOrSession as any;
    const role = session.adminRole || session.role || '';

    if (role === 'SUPER_ADMIN') return true;

    const perms = session.adminPermissions || session.permissions;
    if (perms && Array.isArray(perms) && perms.length > 0) {
      return perms.includes(permission);
    }

    return hasPermission(role, permission);
  }

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
