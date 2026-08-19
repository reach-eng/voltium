/**
 * Permission descriptors — the canonical list of all permission keys
 * with their human-readable labels and category groupings.
 *
 * ━ Ticket #15 consolidation ━
 * This is now the single source of truth for permission keys. The
 * role-permission matrix lives in `permissions-roles.ts` and is keyed
 * by descriptor `key`. A startup test (`permissions-sync.test.ts`)
 * verifies every descriptor has a corresponding role map entry.
 *
 * Browser-safe: no DB/prisma imports.
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

export interface PermissionDescriptor {
  readonly key: string;
  readonly label: string;
  readonly category: string;
}

// Canonical source. Add new permissions here ONLY — role assignments
// go in `permissions-roles.ts`.
export const PERMISSION_DESCRIPTORS: readonly PermissionDescriptor[] = [
  // Riders
  { key: 'riders_view', label: 'View Riders', category: 'Riders' },
  { key: 'riders_create', label: 'Create Riders', category: 'Riders' },
  { key: 'riders_update', label: 'Update Riders', category: 'Riders' },
  { key: 'riders_delete', label: 'Delete Riders', category: 'Riders' },
  { key: 'riders_delete_request', label: 'Request Rider Deletion', category: 'Riders' },
  { key: 'riders_delete_approve', label: 'Approve Rider Deletion', category: 'Riders' },
  { key: 'riders_delete_recover', label: 'Recover Deleted Rider', category: 'Riders' },
  { key: 'riders_manage', label: 'Manage Riders (bulk)', category: 'Riders' },
  { key: 'impersonate_riders', label: 'Impersonate Riders (dev)', category: 'Riders' },

  // KYC
  { key: 'kyc_view', label: 'View KYC', category: 'Riders' },
  { key: 'kyc_approve', label: 'Approve KYC', category: 'Riders' },
  { key: 'kyc_reject', label: 'Reject KYC', category: 'Riders' },
  { key: 'kyc_bulk_approve', label: 'Bulk Approve KYC', category: 'Riders' },
  { key: 'kyc_add_field_note', label: 'Add KYC Field Note', category: 'Riders' },
  { key: 'kyc_view_limited', label: 'View KYC (Limited)', category: 'Riders' },

  // Guarantor
  { key: 'guarantor_view_limited', label: 'View Guarantor (Limited)', category: 'Riders' },
  { key: 'guarantor_approve', label: 'Approve Guarantor', category: 'Riders' },

  // Vehicles
  { key: 'vehicles_view', label: 'View Vehicles', category: 'Vehicles' },
  { key: 'vehicles_create', label: 'Create Vehicles', category: 'Vehicles' },
  { key: 'vehicles_update', label: 'Update Vehicles', category: 'Vehicles' },
  { key: 'vehicles_delete', label: 'Delete Vehicles', category: 'Vehicles' },
  { key: 'vehicles_inspect', label: 'Inspect Vehicles', category: 'Vehicles' },

  // Rentals
  { key: 'rentals_pickup_inspection', label: 'Pickup Inspection', category: 'Rentals' },
  { key: 'rentals_return_inspection', label: 'Return Inspection', category: 'Rentals' },
  // P2.10 (2026-08-05 rentals/vehicles/hubs audit): admins can create a
  // rental on behalf of a locked-out rider (bookRental + syncPickup mirror).
  { key: 'rentals_book', label: 'Book Rentals On Behalf', category: 'Rentals' },

  // Hubs
  { key: 'hubs_manage', label: 'Manage Hubs', category: 'Hubs' },
  { key: 'fleet_manage', label: 'Manage Fleet', category: 'Hubs' },

  // Referrals & Rewards
  { key: 'referrals_view', label: 'View Referrals', category: 'Referrals' },
  { key: 'rewards_manage', label: 'Manage Rewards', category: 'Referrals' },

  // Transactions / Finance
  { key: 'transactions_view', label: 'View Transactions', category: 'Finance' },
  { key: 'transactions_approve', label: 'Approve Transactions', category: 'Finance' },
  { key: 'transactions_reject', label: 'Reject Transactions', category: 'Finance' },
  { key: 'transactions_manage', label: 'Manage Transactions', category: 'Finance' },
  { key: 'finance_view', label: 'View Finance', category: 'Finance' },
  { key: 'finance_reconcile', label: 'Run Wallet Reconciliation', category: 'Finance' },
  { key: 'payment_gateways_manage', label: 'Manage Payment Gateways', category: 'Finance' },
  { key: 'plans_manage', label: 'Manage Plans', category: 'Finance' },
  { key: 'plans_view', label: 'View Plans', category: 'Finance' },
  { key: 'earnings_view', label: 'View Rider Earnings', category: 'Finance' },

  // Tickets / Support
  { key: 'tickets_view', label: 'View Tickets', category: 'Support' },
  { key: 'tickets_resolve', label: 'Resolve Tickets', category: 'Support' },
  { key: 'tickets_manage', label: 'Manage Tickets', category: 'Support' },
  { key: 'faq_manage', label: 'Manage FAQs', category: 'Support' },
  { key: 'notifications_manage', label: 'Manage Notifications', category: 'Support' },

  // Devices
  { key: 'device_tracking_view', label: 'View Device Tracking', category: 'Devices' },
  { key: 'device_remote_control', label: 'Remote Device Control', category: 'Devices' },

  // Files
  { key: 'files_view_kyc', label: 'View KYC Files', category: 'Files' },
  { key: 'files_view_payment_proof', label: 'View Payment Proof', category: 'Files' },
  { key: 'files_view_support_attachment', label: 'View Support Attachments', category: 'Files' },

  // Data Management
  { key: 'data_management_view', label: 'View Data Management', category: 'Data Management' },
  { key: 'data_management_backup', label: 'Trigger Backup', category: 'Data Management' },
  { key: 'data_management_restore', label: 'Trigger Restore', category: 'Data Management' },
  { key: 'data_management_schedule', label: 'Schedule Backups', category: 'Data Management' },
  { key: 'data_management_download', label: 'Download Backup', category: 'Data Management' },
  { key: 'data_management_test', label: 'Test Backup/Restore', category: 'Data Management' },

  // Incidents & Shifts
  { key: 'ops_read', label: 'View Operations Overview', category: 'Operations' },
  { key: 'incidents_manage', label: 'Manage Incidents', category: 'Operations' },
  { key: 'shifts_manage', label: 'Manage Shifts', category: 'Operations' },

  // Admin operations
  { key: 'admins_manage', label: 'Manage Admins', category: 'Admin' },
  { key: 'tl_manage', label: 'Manage Team Leaders (legacy)', category: 'Admin' },
  { key: 'team_leaders_manage', label: 'Manage Team Leaders', category: 'Admin' },
  { key: 'settings_manage', label: 'Manage Settings', category: 'Admin' },
  { key: 'legal_manage', label: 'Manage Legal', category: 'Admin' },
  { key: 'offers_manage', label: 'Manage Offers', category: 'Admin' },
  { key: 'jobs_view', label: 'View Background Jobs', category: 'Admin' },
  { key: 'jobs_run', label: 'Run Background Jobs', category: 'Admin' },

  // Analytics & System
  { key: 'analytics_view', label: 'View Analytics', category: 'System' },
  { key: 'audit_view', label: 'View Audit Log', category: 'System' },
  { key: 'audit_cleanup', label: 'Clean Audit Logs', category: 'System' },
  { key: 'health_view', label: 'View System Health', category: 'System' },
] as const;

/**
 * Helper: get the set of all descriptor keys. Use this for validation
 * (e.g. when an admin's permissions JSON string is parsed from DB).
 */
export const PERMISSION_KEYS: ReadonlySet<string> = new Set(
  PERMISSION_DESCRIPTORS.map((d) => d.key)
);
