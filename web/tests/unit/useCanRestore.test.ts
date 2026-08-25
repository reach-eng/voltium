/**
 * W4 / PR-1 tests for `adminHasPermission` — the permission helper
 * behind the `useCanRestore` gate.
 *
 * Fail-closed contract: if the role is missing, denied. SUPER_ADMIN
 * is unconditionally allowed. Everyone else is allowed only if the
 * explicit `adminPermissions` array contains the key.
 */
import { describe, it, expect } from 'vitest';
import { adminHasPermission } from '@/hooks/useCanRestore';

describe('adminHasPermission', () => {
  it('denies an empty role', () => {
    expect(adminHasPermission(undefined, [], 'data_management_manage')).toBe(false);
    expect(adminHasPermission('', [], 'data_management_manage')).toBe(false);
  });

  it('allows SUPER_ADMIN unconditionally (no explicit grant needed)', () => {
    expect(adminHasPermission('SUPER_ADMIN', [], 'data_management_manage')).toBe(true);
    expect(adminHasPermission('SUPER_ADMIN', undefined, 'data_management_manage')).toBe(true);
  });

  it('denies a non-SUPER_ADMIN without the explicit grant', () => {
    expect(adminHasPermission('OPERATIONS_ADMIN', [], 'data_management_manage')).toBe(false);
    expect(adminHasPermission('FINANCE_ADMIN', undefined, 'kYC_approve')).toBe(false);
  });

  it('allows a non-SUPER_ADMIN with the explicit grant', () => {
    expect(
      adminHasPermission('OPERATIONS_ADMIN', ['data_management_manage'], 'data_management_manage')
    ).toBe(true);
    expect(
      adminHasPermission('FINANCE_ADMIN', ['kyc_approve', 'data_management_manage'], 'kyc_approve')
    ).toBe(true);
  });

  it('is exact-match on the permission key', () => {
    expect(adminHasPermission('OPERATIONS_ADMIN', ['data_management_manage'], 'admins_manage')).toBe(
      false
    );
  });
});

