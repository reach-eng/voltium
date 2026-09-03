/**
 * Role-permission matrix — for each permission, which admin roles
 * are allowed to use it.
 *
 * ━ Ticket #15 consolidation ━
 * This is the policy file. Permission keys are sourced from
 * `permissions-descriptors.ts` — adding a key there without
 * adding an entry here is a startup-time error caught by
 * `permissions-sync.test.ts`.
 *
 * SUPER_ADMIN implicitly has all permissions (handled in
 * `hasPermission`, not listed here for compactness).
 *
 * Browser-safe: no DB/prisma imports.
 */

import type { AdminRole } from './permissions-descriptors';

type RoleSet = readonly AdminRole[];

export const ROLE_PERMISSIONS: Readonly<Record<string, RoleSet>> = {
  // Riders
  riders_view: ['OPERATIONS_ADMIN', 'KYC_REVIEWER', 'FINANCE_ADMIN', 'SUPPORT_AGENT', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER'],
  riders_create: ['OPERATIONS_ADMIN', 'TEAM_LEADER'],
  riders_update: ['OPERATIONS_ADMIN', 'FLEET_MANAGER'],
  riders_delete: [],
  riders_delete_request: ['OPERATIONS_ADMIN'],
  riders_delete_approve: [],
  riders_delete_recover: [],
  riders_manage: ['OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER'],
  impersonate_riders: ['OPERATIONS_ADMIN'],

  // KYC
  kyc_view: ['OPERATIONS_ADMIN', 'KYC_REVIEWER', 'TEAM_LEADER'],
  kyc_approve: ['OPERATIONS_ADMIN', 'KYC_REVIEWER'],
  kyc_reject: ['OPERATIONS_ADMIN', 'KYC_REVIEWER'],
  kyc_bulk_approve: ['OPERATIONS_ADMIN', 'KYC_REVIEWER'],
  kyc_add_field_note: ['OPERATIONS_ADMIN', 'KYC_REVIEWER', 'TEAM_LEADER'],
  kyc_view_limited: ['OPERATIONS_ADMIN', 'KYC_REVIEWER', 'TEAM_LEADER'],

  // Guarantor
  guarantor_view_limited: ['OPERATIONS_ADMIN', 'KYC_REVIEWER', 'TEAM_LEADER'],
  guarantor_approve: ['OPERATIONS_ADMIN', 'KYC_REVIEWER'],

  // Vehicles
  vehicles_view: ['OPERATIONS_ADMIN', 'FLEET_MANAGER', 'HUB_MANAGER'],
  vehicles_create: ['OPERATIONS_ADMIN', 'FLEET_MANAGER'],
  vehicles_update: ['OPERATIONS_ADMIN', 'FLEET_MANAGER'],
  vehicles_delete: [],
  vehicles_inspect: ['OPERATIONS_ADMIN', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER'],

  // Rentals
  rentals_pickup_inspection: ['OPERATIONS_ADMIN', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER'],
  rentals_return_inspection: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER'],
  // P2.10 (2026-08-05 rentals/vehicles/hubs audit): booking on behalf of a
  // locked-out rider is a support/ops capability. Ops + support + hub/fleet
  // managers can create a rental; TEAM_LEADER is excluded (field staff book
  // via pickup inspection, not on-behalf creation).
  rentals_book: ['OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'HUB_MANAGER', 'FLEET_MANAGER'],

  // Hubs
  hubs_manage: ['OPERATIONS_ADMIN', 'HUB_MANAGER'],
  fleet_manage: ['OPERATIONS_ADMIN', 'HUB_MANAGER', 'FLEET_MANAGER'],

  // Referrals & Rewards
  referrals_view: ['OPERATIONS_ADMIN', 'SUPPORT_AGENT'],
  rewards_manage: ['OPERATIONS_ADMIN'],

  // Transactions / Finance
  transactions_view: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN'],
  transactions_approve: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN'],
  transactions_reject: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN'],
  transactions_manage: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN'],
  finance_view: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN'],
  // P0-4 (financial audit): reconciliation is a money-integrity operation —
  // only ops + finance roles may trigger it (READ_ONLY is excluded).
  finance_reconcile: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN'],
  payment_gateways_manage: ['FINANCE_ADMIN'],
  plans_manage: ['OPERATIONS_ADMIN'],
  plans_view: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'READ_ONLY'],
  earnings_view: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN'],

  // Tickets / Support
  tickets_view: ['OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'TEAM_LEADER'],
  tickets_resolve: ['OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'TEAM_LEADER'],
  tickets_manage: ['OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'TEAM_LEADER'],
  faq_manage: ['OPERATIONS_ADMIN', 'SUPPORT_AGENT'],
  notifications_manage: ['OPERATIONS_ADMIN', 'SUPPORT_AGENT'],

  // Devices
  device_tracking_view: ['OPERATIONS_ADMIN', 'FLEET_MANAGER'],
  device_remote_control: ['OPERATIONS_ADMIN'],

  // Files
  files_view_kyc: ['OPERATIONS_ADMIN', 'KYC_REVIEWER'],
  files_view_payment_proof: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN'],
  files_view_support_attachment: ['OPERATIONS_ADMIN', 'SUPPORT_AGENT'],

  // Data Management
  data_management_view: ['SUPER_ADMIN', 'READ_ONLY'],
  data_management_backup: ['SUPER_ADMIN'],
  data_management_restore: ['SUPER_ADMIN'],
  data_management_schedule: ['SUPER_ADMIN'],
  data_management_download: ['SUPER_ADMIN'],
  data_management_test: ['SUPER_ADMIN'],

  // Incidents & Shifts
  ops_read: ['OPERATIONS_ADMIN', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER', 'SUPER_ADMIN'],
  incidents_manage: ['OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'HUB_MANAGER', 'FLEET_MANAGER'],
  shifts_manage: ['OPERATIONS_ADMIN', 'HUB_MANAGER'],

  // Admin operations
  admins_manage: [],
  tl_manage: ['OPERATIONS_ADMIN'],
  team_leaders_manage: ['OPERATIONS_ADMIN'],
  // System settings are SUPER_ADMIN-only (the route additionally requires
  // `session.adminRole === 'SUPER_ADMIN'` for writes). Granting it to
  // OPERATIONS_ADMIN here broke the rbac.test contract.
  settings_manage: ['SUPER_ADMIN'],
  legal_manage: ['OPERATIONS_ADMIN'],
  offers_manage: ['OPERATIONS_ADMIN'],
  jobs_view: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'FLEET_MANAGER', 'HUB_MANAGER'],
  jobs_run: ['OPERATIONS_ADMIN'],

  // Analytics & System
  analytics_view: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'FLEET_MANAGER', 'HUB_MANAGER'],
  // P0-2 (2026-08-05 ops audit): READ_ONLY dropped — audit logs contain
  // actor graph + rider entityIds (spear-phishing intel). Only ops/finance.
  audit_view: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN'],
  audit_cleanup: [],
  health_view: ['OPERATIONS_ADMIN', 'READ_ONLY'],
} as const;
