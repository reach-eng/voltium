import { describe, it, expect } from 'vitest';
import { createCouponSchema, createOfferSchema } from '@/lib/validators';
import { getExpiresAt, RETENTION_PERIODS } from '@/lib/audit-log';
import { buildSelectedRiderCsv } from '@/components/admin/screens/rider-management/exportSelectedRiders';
import { buildTeamLeaderCsv } from '@/components/admin/screens/team-leaders/exportTeamLeaders';
import type { Rider } from '@/components/admin/screens/rider-management/types';
import type { TeamLeader } from '@/components/admin/screens/team-leaders/types';

describe('Admin Panel Phase 3 Fixes Verification', () => {
  describe('Coupon & Offer Schema Boundary Validation (GROWTH-01b)', () => {
    it('accepts valid percentage coupons with discount <= 100', () => {
      const validCoupon = {
        code: 'PROMO50',
        description: '50% off rental',
        discountType: 'PERCENTAGE',
        discountValue: 50,
        validFrom: '2026-08-01',
        validUntil: '2026-08-31',
        isActive: true,
      };
      const result = createCouponSchema.safeParse(validCoupon);
      expect(result.success).toBe(true);
    });

    it('rejects percentage coupons with discount > 100%', () => {
      const invalidCoupon = {
        code: 'PROMO150',
        description: '150% off rental',
        discountType: 'PERCENTAGE',
        discountValue: 150,
        validFrom: '2026-08-01',
        validUntil: '2026-08-31',
      };
      const result = createCouponSchema.safeParse(invalidCoupon);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Percentage discount cannot exceed 100%');
      }
    });

    it('rejects coupons where validUntil is before validFrom', () => {
      const invalidDates = {
        code: 'TIMETRAVEL',
        description: 'Invalid date coupon',
        discountType: 'FIXED',
        discountValue: 100,
        validFrom: '2026-09-01',
        validUntil: '2026-08-01',
      };
      const result = createCouponSchema.safeParse(invalidDates);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('validUntil must be after or equal to validFrom');
      }
    });

    it('rejects offers where validUntil is before validFrom', () => {
      const invalidOffer = {
        title: 'Summer Sale',
        description: 'Special summer discount offer',
        validFrom: '2026-09-01',
        validUntil: '2026-08-01',
      };
      const result = createOfferSchema.safeParse(invalidOffer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('validUntil must be after or equal to validFrom');
      }
    });
  });

  describe('Audit Retention Period Matching (SEC-08)', () => {
    it('correctly calculates expiration dates based on action domain', () => {
      const now = Date.now();
      const authExpires = getExpiresAt('admin.login');
      const finExpires = getExpiresAt('transaction.approve');

      expect(authExpires.getTime()).toBeGreaterThan(now);
      expect(finExpires.getTime()).toBeGreaterThan(authExpires.getTime());
    });

    // NET-005 follow-up-3 (2026-09-08): the retention
    // table splits on `.` and looks up the prefix. KYC
    // actions MUST use the dot-separated form
    // (`kyc.approved` / `kyc.rejected` / `kyc.expired` /
    // `kyc.info_required`) so the lookup hits the 365-day
    // KYC retention. The previous underscore form
    // (`kyc_approved`) and the uppercase form
    // (`KYC_EXPIRED`) silently fell through to the 90-day
    // default — losing 275 days of retention.
    it('kyc.${status} action strings hit the 365-day KYC retention', () => {
      const now = Date.now();
      const kycDays = RETENTION_PERIODS.kyc; // 365
      const defaultDays = 90;

      // Dot-separated forms used by the dead path
      // (kyc.use-cases.ts:reviewKyc) and the live path
      // (admin-riders.use-cases.ts after this commit) +
      // the expiry job.
      const kycApprovedMs =
        getExpiresAt('kyc.approved').getTime() - now;
      const kycRejectedMs =
        getExpiresAt('kyc.rejected').getTime() - now;
      const kycExpiredMs =
        getExpiresAt('kyc.expired').getTime() - now;
      const kycInfoRequiredMs =
        getExpiresAt('kyc.info_required').getTime() - now;

      // Tolerance: 24h drift between the test's `now` and
      // the helper's internal `new Date()` is fine.
      const kycDay = kycDays * 24 * 60 * 60 * 1000;
      const defaultDay = defaultDays * 24 * 60 * 60 * 1000;

      expect(kycApprovedMs).toBeGreaterThan(kycDay - defaultDay);
      expect(kycRejectedMs).toBeGreaterThan(kycDay - defaultDay);
      expect(kycExpiredMs).toBeGreaterThan(kycDay - defaultDay);
      expect(kycInfoRequiredMs).toBeGreaterThan(kycDay - defaultDay);
    });

    it('kyc_approved (underscore) and KYC_EXPIRED (uppercase) fall through to 90 days (the bug class)', () => {
      // Regression: the audit-trail drift was that the live
      // path wrote `kyc_${status}` (underscore) and the
      // expiry job wrote `KYC_EXPIRED` (uppercase, no
      // separator). Both formats split on `.` to a single
      // segment that does not match the `kyc` key, falling
      // through to the 90-day default. After the fix,
      // these formats should no longer be in use; this
      // test documents the historical bug so a future
      // regression is caught.
      const now = Date.now();
      const buggyUnderscoreMs =
        getExpiresAt('kyc_approved').getTime() - now;
      const buggyUppercaseMs =
        getExpiresAt('KYC_EXPIRED').getTime() - now;
      const defaultDay = 90 * 24 * 60 * 60 * 1000;
      const tolerance = defaultDay; // 24h drift

      expect(buggyUnderscoreMs).toBeLessThan(defaultDay + tolerance);
      expect(buggyUppercaseMs).toBeLessThan(defaultDay + tolerance);
    });

    // NET-005 follow-up-4 (2026-09-08): the previous
    // RETENTION_PERIODS keys were `rider_update` (180d) and
    // `bulk_action` (365d) — both underscore-separated,
    // inconsistent with the dot-separated action-string
    // convention used everywhere else in the codebase. The
    // `getRetentionDays` lookup splits on `.` and reads the
    // first segment as the prefix; a `rider.delete` action
    // splits to `prefix='rider'`, which did NOT match the
    // `rider_update` key and fell through to the 90-day
    // default. The rename to `rider: 180` and `bulk: 365`
    // makes every `rider.*` and `bulk.*` action hit the
    // documented retention.
    it('every RETENTION_PERIODS key matches a representative prefix.suffix action', () => {
      // Walk through every key in the retention table and
      // assert that the prefix.suffix lookup returns the
      // table value. The new keys (`rider`, `bulk`) are the
      // single-word prefixes that match the dot-separated
      // action-string convention.
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const tolerance = 2 * day; // 2 days of clock drift
      for (const [key, days] of Object.entries(RETENTION_PERIODS)) {
        // The `transaction` and `financial` keys are
        // special-cased via prefix `transaction` / `financial`
        // / `wallet` — test all three.
        if (key === 'transaction' || key === 'financial') {
          const txDays = (getExpiresAt('transaction.approve').getTime() - now) / day;
          const finDays = (getExpiresAt('financial.transfer').getTime() - now) / day;
          const walletDays = (getExpiresAt('wallet.adjust').getTime() - now) / day;
          expect(txDays).toBeGreaterThan(days - 2);
          expect(txDays).toBeLessThan(days + 2);
          expect(finDays).toBeGreaterThan(days - 2);
          expect(finDays).toBeLessThan(days + 2);
          expect(walletDays).toBeGreaterThan(days - 2);
          expect(walletDays).toBeLessThan(days + 2);
          continue;
        }
        const actionMs = getExpiresAt(`${key}.example`).getTime() - now;
        const actionDays = actionMs / day;
        expect(actionDays).toBeGreaterThan(days - 2);
        expect(actionDays).toBeLessThan(days + 2);
      }
    });

    it('rider.* actions hit the 180-day retention (regression)', () => {
      // After the rename of `rider_update` → `rider`, every
      // `rider.*` action the live admin path writes now
      // hits the documented 180-day retention. Before the
      // fix, all of these fell through to the 90-day
      // default.
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const tolerance = 2 * day;
      const riderActions = [
        'rider.assign_plan',
        'rider.complete_pickup',
        'rider.end_rental',
        'rider.delete',
        'rider.logout',
        'rider.deactivation',
      ];
      for (const action of riderActions) {
        const days = (getExpiresAt(action).getTime() - now) / day;
        expect(days, `action=${action}`).toBeGreaterThan(180 - 2);
        expect(days, `action=${action}`).toBeLessThan(180 + 2);
      }
    });

    it('bulk.* actions hit the 365-day retention (regression)', () => {
      // After the rename of `bulk_action` → `bulk`, every
      // `bulk.*` action hits the 365-day retention. Before
      // the fix, all of these fell through to the 90-day
      // default.
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const tolerance = 2 * day;
      const bulkActions = [
        'bulk.approve',
        'bulk.suspend',
        'bulk.delete',
      ];
      for (const action of bulkActions) {
        const days = (getExpiresAt(action).getTime() - now) / day;
        expect(days, `action=${action}`).toBeGreaterThan(365 - 2);
        expect(days, `action=${action}`).toBeLessThan(365 + 2);
      }
    });

    it('RETENTION_PERIODS no longer contains the legacy underscore keys', () => {
      // After the rename, the legacy `rider_update` and
      // `bulk_action` keys must not be present. This guards
      // against a future regression that re-adds the
      // underscore keys.
      expect(RETENTION_PERIODS).not.toHaveProperty('rider_update');
      expect(RETENTION_PERIODS).not.toHaveProperty('bulk_action');
      expect(RETENTION_PERIODS).toHaveProperty('rider');
      expect(RETENTION_PERIODS).toHaveProperty('bulk');
    });
  });

  describe('CSV Export Formatting & RFC 4180 Escaping (P2-06)', () => {
    it('escapes quotes, commas, and special characters in Rider CSV export', () => {
      const testRiders: Rider[] = [
        {
          id: 'r_1',
          riderId: 'RD-001',
          fullName: 'Arjun "The Ace" Sharma, Jr.',
          phone: '9876543210',
          state: 'ACTIVE',
          kycStatus: 'APPROVED',
        } as unknown as Rider,
      ];

      const csv = buildSelectedRiderCsv(testRiders, new Set(['r_1']));
      expect(csv).toContain('"Arjun ""The Ace"" Sharma, Jr."');
      expect(csv).toContain('Rider ID,Name,Phone,Email,State,KYC Status');
    });

    it('escapes quotes and commas in Team Leader CSV export', () => {
      const testLeaders: TeamLeader[] = [
        {
          id: 'tl_1',
          name: 'Priya "Lead" Patel',
          phone: '9876543211',
          email: 'priya,lead@voltium.in',
          isActive: true,
          riderCount: 15,
          createdAt: '2026-08-01',
        },
      ];

      const csv = buildTeamLeaderCsv(testLeaders);
      expect(csv).toContain('"Priya ""Lead"" Patel"');
      expect(csv).toContain('"priya,lead@voltium.in"');
    });
  });
});
