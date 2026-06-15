/**
 * Unit tests for RBAC (Role-Based Access Control) system.
 *
 * Tests the permission hierarchy from auth.ts against the admin roles
 * defined in state machines and the refactoring plan.
 */

import { describe, it, expect } from 'vitest';
import { hasPermission, getPermissionsForRole, type Permission } from '@/lib/auth';

describe('RBAC — Super Admin', () => {
  const role = 'SUPER_ADMIN';

  it('has ALL permissions', () => {
    // Riders
    expect(hasPermission(role, 'riders_view')).toBe(true);
    expect(hasPermission(role, 'riders_create')).toBe(true);
    expect(hasPermission(role, 'riders_update')).toBe(true);
    expect(hasPermission(role, 'riders_delete')).toBe(true);

    // KYC
    expect(hasPermission(role, 'kyc_view')).toBe(true);
    expect(hasPermission(role, 'kyc_approve')).toBe(true);
    expect(hasPermission(role, 'kyc_reject')).toBe(true);

    // Vehicles
    expect(hasPermission(role, 'vehicles_view')).toBe(true);
    expect(hasPermission(role, 'vehicles_create')).toBe(true);
    expect(hasPermission(role, 'vehicles_delete')).toBe(true);

    // Finance
    expect(hasPermission(role, 'transactions_view')).toBe(true);
    expect(hasPermission(role, 'transactions_approve')).toBe(true);
    expect(hasPermission(role, 'transactions_manage')).toBe(true);

    // Support
    expect(hasPermission(role, 'tickets_view')).toBe(true);
    expect(hasPermission(role, 'tickets_resolve')).toBe(true);
    expect(hasPermission(role, 'tickets_manage')).toBe(true);

    // System
    expect(hasPermission(role, 'admins_manage')).toBe(true);
    expect(hasPermission(role, 'settings_manage')).toBe(true);
    expect(hasPermission(role, 'legal_manage')).toBe(true);

    // Marketing
    expect(hasPermission(role, 'offers_manage')).toBe(true);
    expect(hasPermission(role, 'rewards_manage')).toBe(true);

    // Security
    expect(hasPermission(role, 'device_tracking_view')).toBe(true);
    expect(hasPermission(role, 'device_remote_control')).toBe(true);
  });
});

describe('RBAC — Admin', () => {
  const role = 'ADMIN';

  it('has core operational permissions', () => {
    expect(hasPermission(role, 'riders_view')).toBe(true);
    expect(hasPermission(role, 'riders_create')).toBe(true);
    expect(hasPermission(role, 'riders_update')).toBe(true);
    expect(hasPermission(role, 'riders_delete')).toBe(true);

    expect(hasPermission(role, 'kyc_view')).toBe(true);
    expect(hasPermission(role, 'kyc_approve')).toBe(true);
    expect(hasPermission(role, 'kyc_reject')).toBe(true);

    expect(hasPermission(role, 'transactions_view')).toBe(true);
    expect(hasPermission(role, 'transactions_approve')).toBe(true);
    expect(hasPermission(role, 'transactions_reject')).toBe(true);
    expect(hasPermission(role, 'transactions_manage')).toBe(true);

    expect(hasPermission(role, 'admins_manage')).toBe(true);
    expect(hasPermission(role, 'settings_manage')).toBe(true);
    expect(hasPermission(role, 'offers_manage')).toBe(true);
    expect(hasPermission(role, 'device_remote_control')).toBe(true);
  });
});

describe('RBAC — Manager', () => {
  const role = 'MANAGER';

  it('has view permissions and basic operations', () => {
    expect(hasPermission(role, 'riders_view')).toBe(true);
    expect(hasPermission(role, 'riders_create')).toBe(true);
    expect(hasPermission(role, 'riders_update')).toBe(true);

    expect(hasPermission(role, 'kyc_view')).toBe(true);
    expect(hasPermission(role, 'vehicles_view')).toBe(true);
    expect(hasPermission(role, 'vehicles_create')).toBe(true);

    expect(hasPermission(role, 'transactions_view')).toBe(true);
    expect(hasPermission(role, 'tickets_view')).toBe(true);
    expect(hasPermission(role, 'tickets_resolve')).toBe(true);
    expect(hasPermission(role, 'tickets_manage')).toBe(true);

    expect(hasPermission(role, 'analytics_view')).toBe(true);
    expect(hasPermission(role, 'referrals_view')).toBe(true);
    expect(hasPermission(role, 'device_tracking_view')).toBe(true);
  });

  it('lacks finance admin operations', () => {
    expect(hasPermission(role, 'transactions_approve')).toBe(false);
    expect(hasPermission(role, 'transactions_reject')).toBe(false);
    expect(hasPermission(role, 'transactions_manage')).toBe(false);
  });

  it('lacks system admin operations', () => {
    expect(hasPermission(role, 'riders_delete')).toBe(false);
    expect(hasPermission(role, 'vehicles_delete')).toBe(false);
    expect(hasPermission(role, 'admins_manage')).toBe(false);
    expect(hasPermission(role, 'settings_manage')).toBe(false);
    expect(hasPermission(role, 'offers_manage')).toBe(false);
    expect(hasPermission(role, 'device_remote_control')).toBe(false);
  });
});

describe('RBAC — Fleet Manager', () => {
  const role = 'FLEET_MANAGER';

  it('has vehicle and rider permissions', () => {
    expect(hasPermission(role, 'riders_view')).toBe(true);
    expect(hasPermission(role, 'riders_update')).toBe(true);

    expect(hasPermission(role, 'vehicles_view')).toBe(true);
    expect(hasPermission(role, 'vehicles_create')).toBe(true);
    expect(hasPermission(role, 'vehicles_update')).toBe(true);
    expect(hasPermission(role, 'hubs_manage')).toBe(true);

    expect(hasPermission(role, 'analytics_view')).toBe(true);
  });

  it('lacks finance and support permissions', () => {
    expect(hasPermission(role, 'transactions_approve')).toBe(false);
    expect(hasPermission(role, 'transactions_reject')).toBe(false);
    expect(hasPermission(role, 'tickets_manage')).toBe(false);
    expect(hasPermission(role, 'kyc_approve')).toBe(false);
    expect(hasPermission(role, 'admins_manage')).toBe(false);
  });
});

describe('RBAC — Team Leader', () => {
  const role = 'TEAM_LEADER';

  it('has KYC review and rider view permissions', () => {
    expect(hasPermission(role, 'riders_view')).toBe(true);
    expect(hasPermission(role, 'riders_create')).toBe(true);

    expect(hasPermission(role, 'kyc_view')).toBe(true);
    expect(hasPermission(role, 'kyc_approve')).toBe(true);
    expect(hasPermission(role, 'kyc_reject')).toBe(true);

    expect(hasPermission(role, 'tickets_view')).toBe(true);
    expect(hasPermission(role, 'tickets_resolve')).toBe(true);
    expect(hasPermission(role, 'tickets_manage')).toBe(true);
  });

  it('lacks sensitive operations', () => {
    expect(hasPermission(role, 'transactions_view')).toBe(false);
    expect(hasPermission(role, 'transactions_approve')).toBe(false);
    expect(hasPermission(role, 'riders_delete')).toBe(false);
    expect(hasPermission(role, 'vehicles_delete')).toBe(false);
    expect(hasPermission(role, 'admins_manage')).toBe(false);
    expect(hasPermission(role, 'settings_manage')).toBe(false);
    expect(hasPermission(role, 'offers_manage')).toBe(false);
    expect(hasPermission(role, 'device_remote_control')).toBe(false);
    expect(hasPermission(role, 'hubs_manage')).toBe(false);
  });
});

describe('RBAC — Edge Cases', () => {
  it('handles unknown roles gracefully', () => {
    expect(hasPermission('UNKNOWN_ROLE', 'riders_view' as Permission)).toBe(false);
    expect(hasPermission('', 'riders_view' as Permission)).toBe(false);
  });

  it('handles null/undefined roles', () => {
    expect(hasPermission(null as any, 'riders_view' as Permission)).toBe(false);
    expect(hasPermission(undefined as any, 'riders_view' as Permission)).toBe(false);
  });

  it('super admin has every permission in the list', () => {
    const perms = getPermissionsForRole('SUPER_ADMIN');
    expect(perms.length).toBeGreaterThan(30); // There are 30+ permissions defined
    expect(perms).toContain('riders_view');
    expect(perms).toContain('kyc_approve');
    expect(perms).toContain('transactions_manage');
    expect(perms).toContain('device_remote_control');
  });

  it('returns empty array for unknown role', () => {
    const perms = getPermissionsForRole('NONEXISTENT');
    expect(perms).toEqual([]);
  });
});
