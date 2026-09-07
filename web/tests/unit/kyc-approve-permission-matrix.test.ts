import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS } from '@/lib/permissions-roles';

// NET-005 follow-up-6 (2026-09-08): the live rider-update
// route (`web/src/app/api/admin/riders/route.ts:PUT`) was
// gated only by `riders_update` = [OPERATIONS_ADMIN,
// FLEET_MANAGER]. The route body carries `kycStatus`, so a
// FLEET_MANAGER could approve / reject / info-request KYC
// through the same endpoint. The dead path
// (`/api/admin/kyc/route.ts:110`) already enforces
// `kyc_approve` = [OPERATIONS_ADMIN, KYC_REVIEWER]. The fix
// in the route layer adds the same gate for any KYC
// decision in the live path.
//
// This test locks the contract: the FLEET_MANAGER role is
// in `riders_update` (so fleet managers can do non-KYC
// rider updates) but NOT in `kyc_approve` (so they cannot
// change KYC status). If a future change relaxes the
// matrix, this test fails before the drift ships.

describe('NET-005 follow-up-6: KYC approve permission matrix', () => {
  it('FLEET_MANAGER is in riders_update but NOT in kyc_approve', () => {
    expect(ROLE_PERMISSIONS.riders_update).toContain('FLEET_MANAGER');
    expect(ROLE_PERMISSIONS.kyc_approve).not.toContain('FLEET_MANAGER');
  });

  it('KYC_REVIEWER is in kyc_approve but NOT in riders_update', () => {
    expect(ROLE_PERMISSIONS.kyc_approve).toContain('KYC_REVIEWER');
    expect(ROLE_PERMISSIONS.riders_update).not.toContain('KYC_REVIEWER');
  });

  it('OPERATIONS_ADMIN is in both riders_update and kyc_approve', () => {
    expect(ROLE_PERMISSIONS.riders_update).toContain('OPERATIONS_ADMIN');
    expect(ROLE_PERMISSIONS.kyc_approve).toContain('OPERATIONS_ADMIN');
  });

  it('kyc_approve and kyc_reject share the same allowlist', () => {
    // The dead-path matrix treats approve / reject /
    // bulk_approve as the same gate. The live path's
    // guard requires `kyc_approve` for any KYC decision
    // (APPROVED / REJECTED / INFO_REQUIRED), so the same
    // allowlist should back all three.
    expect(ROLE_PERMISSIONS.kyc_approve).toEqual(
      ROLE_PERMISSIONS.kyc_reject
    );
  });

  it('kyc_bulk_approve shares the kyc_approve allowlist (the bulk-rider path uses riders_update, not this)', () => {
    // Note: the bulk rider status endpoint (the toolbar)
    // uses `riders_update` (not `kyc_bulk_approve`) because
    // its action is `updateStatus` (lifecycleStatus), not a
    // KYC decision. The kyc_bulk_approve permission is
    // defined for the per-rider KYC dialogs, not the bulk
    // toolbar. The matrix keeps the same allowlist for
    // consistency — anyone who can approve one KYC can
    // bulk-approve too.
    expect(ROLE_PERMISSIONS.kyc_bulk_approve).toEqual(
      ROLE_PERMISSIONS.kyc_approve
    );
  });
});
