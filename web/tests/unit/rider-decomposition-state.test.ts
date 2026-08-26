/**
 * PR-S — Rider model decomposition state verification.
 *
 * The Rider model has 64 fields. Several child tables have been added
 * over time:
 *   - RiderEarning (1:1 with Rider, earnings data)
 *   - RiderScore (1:1 with Rider, score data)
 *   - RiderPermission (1:N with Rider, per-permission grants)
 *   - RiderAdminLock (1:1 with Rider, device admin + lock)
 *   - RiderPickupPhoto (1:1 with Rider, 5 photos + timestamp)
 *
 * Plus PR-P3.2 added 3 FK columns to Rider (pickupHubId, currentPlanId,
 * teamLeaderId) for future RiderOnboarding decomposition.
 *
 * This test verifies the current state of the decomposition. The full
 * PR-S plan (5 sub-PRs to add RiderPermissions, RiderDevice, RiderLocation,
 * RiderOnboarding, RiderPickupPhotos) is mostly done already via the
 * existing child tables. What's LEFT to ship is the drop of legacy
 * columns, gated on a 1-wk staging soak.
 *
 * Run: npx vitest run tests/unit/rider-decomposition-state.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');

describe('PR-S: Rider model decomposition state', () => {
  const schema = existsSync(SCHEMA_PATH) ? readFileSync(SCHEMA_PATH, 'utf-8') : '';

  it('schema exists', () => {
    expect(existsSync(SCHEMA_PATH)).toBe(true);
    expect(schema.length).toBeGreaterThan(1000);
  });

  describe('child tables that exist (already shipped)', () => {
    it('RiderEarning model exists', () => {
      expect(schema).toMatch(/model\s+RiderEarning\s*\{/);
      expect(schema).toMatch(/@@map\("rider_earnings"\)/);
    });

    it('RiderScore model exists', () => {
      expect(schema).toMatch(/model\s+RiderScore\s*\{/);
      expect(schema).toMatch(/@@map\("rider_scores"\)/);
    });

    it('RiderPermission model exists (1:N per-permission grants)', () => {
      expect(schema).toMatch(/model\s+RiderPermission\s*\{/);
      expect(schema).toMatch(/@@map\("rider_permissions"\)/);
      expect(schema).toMatch(/permission\s+String/);
      expect(schema).toMatch(/granted\s+Boolean/);
    });

    it('RiderAdminLock model exists (1:1 with Rider)', () => {
      expect(schema).toMatch(/model\s+RiderAdminLock\s*\{/);
      expect(schema).toMatch(/@@map\("rider_admin_locks"\)/);
      expect(schema).toMatch(/isAdminLocked\s+Boolean/);
      expect(schema).toMatch(/lockPasswordHash\s+String\?/);
    });

    it('RiderPickupPhoto model exists (1:1 with Rider)', () => {
      expect(schema).toMatch(/model\s+RiderPickupPhoto\s*\{/);
      expect(schema).toMatch(/@@map\("rider_pickup_photos"\)/);
    });
  });

  describe('PR-P3.2 FK columns on Rider', () => {
    it('Rider has pickupHubId, currentPlanId, teamLeaderId', () => {
      const riderMatch = schema.match(/model\s+Rider\s*\{([\s\S]*?)\n\}/);
      expect(riderMatch).toBeTruthy();
      const body = riderMatch![1];
      expect(body).toMatch(/pickupHubId\s+String\?/);
      expect(body).toMatch(/currentPlanId\s+String\?/);
      expect(body).toMatch(/teamLeaderId\s+String\?/);
    });

    it('Rider has back-relations to Hub, RentalPlan, TeamLeader', () => {
      const riderMatch = schema.match(/model\s+Rider\s*\{([\s\S]*?)\n\}/);
      expect(riderMatch).toBeTruthy();
      const body = riderMatch![1];
      expect(body).toMatch(/pickupHubRef\s+Hub\?/);
      expect(body).toMatch(/currentPlanRef\s+RentalPlan\?/);
      expect(body).toMatch(/teamLeaderRef\s+TeamLeader\?/);
    });
  });

  describe('fields still on Rider (yet to be extracted)', () => {
    // PR-S will add: RiderDevice (FCM token, battery level),
    // RiderLocation (lat/lng/at), RiderOnboarding (full onboarding bundle)
    // But the existing child tables cover: earnings, score, per-permission,
    // admin lock, pickup photo
    it('Rider has FCM token (to be moved to RiderDevice)', () => {
      const riderMatch = schema.match(/model\s+Rider\s*\{([\s\S]*?)\n\}/);
      expect(riderMatch).toBeTruthy();
      expect(riderMatch![1]).toMatch(/fcmToken\s+String\?/);
    });

    it('Rider has location fields (to be moved to RiderLocation)', () => {
      const riderMatch = schema.match(/model\s+Rider\s*\{([\s\S]*?)\n\}/);
      expect(riderMatch).toBeTruthy();
      expect(riderMatch![1]).toMatch(/lastKnownLat\s+Float\?/);
      expect(riderMatch![1]).toMatch(/lastKnownLng\s+Float\?/);
      expect(riderMatch![1]).toMatch(/lastLocationAt\s+DateTime\?/);
    });
  });

  describe('legacy columns that should be dropped after staging soak', () => {
    it('Rider still has pickupHub (string) — to be dropped in PR-J', () => {
      const riderMatch = schema.match(/model\s+Rider\s*\{([\s\S]*?)\n\}/);
      expect(riderMatch).toBeTruthy();
      expect(riderMatch![1]).toMatch(/pickupHub\s+String\?/);
    });

    it('Rider still has currentPlan (string) — to be dropped in PR-J', () => {
      const riderMatch = schema.match(/model\s+Rider\s*\{([\s\S]*?)\n\}/);
      expect(riderMatch).toBeTruthy();
      expect(riderMatch![1]).toMatch(/currentPlan\s+String\?/);
    });

    it('Rider still has teamLeader (string) — to be dropped in PR-J', () => {
      const riderMatch = schema.match(/model\s+Rider\s*\{([\s\S]*?)\n\}/);
      expect(riderMatch).toBeTruthy();
      expect(riderMatch![1]).toMatch(/teamLeader\s+String\?/);
    });
  });

  describe('migration history', () => {
    it('has the rider_permissions extraction migration', () => {
      expect(existsSync(
        resolve(__dirname, '../../prisma/migrations/20260728000000_extract_rider_permissions')
      )).toBe(true);
    });

    it('has the rider_admin_locks extraction migration', () => {
      expect(existsSync(
        resolve(__dirname, '../../prisma/migrations/20260728000001_extract_rider_admin_lock_and_pickup')
      )).toBe(true);
    });

    it('has the PR-P3.2 FK columns migration', () => {
      expect(existsSync(
        resolve(__dirname, '../../prisma/migrations/20260730140000_add_rider_fk_columns')
      )).toBe(true);
    });

    it('has the PR-K.1 lifecycle stage migration', () => {
      expect(existsSync(
        resolve(__dirname, '../../prisma/migrations/20260730150000_add_rider_lifecycle_stage')
      )).toBe(true);
    });
  });
});
