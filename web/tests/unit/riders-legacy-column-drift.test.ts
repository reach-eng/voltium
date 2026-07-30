/**
 * PR-S — Legacy column drift test (gates the drop migration).
 *
 * The Rider model still has 9 legacy columns that are also on
 * `RiderAdminLock` (the child table). Both are written by the same
 * writer code, so they should be in sync. This test verifies:
 *
 *   1. The legacy columns are STILL on Rider (i.e. we haven't
 *      shipped a drop migration yet)
 *   2. The child tables exist and have the matching columns
 *   3. The shape contract is preserved (the legacy columns are
 *      a strict subset of the child table columns)
 *
 * When this test is changed to "expect(false)" for the legacy
 * columns, the PR-S drop migration can ship. Until then, the
 * columns must stay.
 *
 * Run: npx vitest run tests/unit/riders-legacy-column-drift.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');

function getModelFields(modelName: string): string[] {
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');
  const match = schema.match(new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) return [];
  return match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[a-zA-Z][a-zA-Z0-9_]*\s+(String|Int|Float|Boolean|DateTime)/.test(l))
    .map((l) => l.split(/\s+/)[0]);
}

describe('PR-S: legacy column drift test (gates the drop migration)', () => {
  describe('Rider legacy columns that should also be on RiderAdminLock', () => {
    const legacyOnAdminLock = [
      'isAdminLocked',
      'lockPasswordHash',
      'isUninstallBlocked',
      'isLocationMandatory',
      'isAppsControlRestricted',
      'deviceAdminGranted',
      'displayOverlayGranted',
      'lastDeviceViolationAt',
      'deviceViolationCount',
    ];
    const adminLockFields = getModelFields('RiderAdminLock');
    const riderFields = getModelFields('Rider');

    for (const f of legacyOnAdminLock) {
      it(`Rider.${f} is still present (gate for drop migration)`, () => {
        expect(riderFields).toContain(f);
      });

      it(`RiderAdminLock.${f} exists (the canonical source)`, () => {
        // RiderAdminLock uses the same field name as Rider.
        expect(adminLockFields).toContain(f);
      });
    }
  });

  describe('Rider legacy columns that should also be on RiderPickupPhoto', () => {
    const legacyOnPickup = [
      'pickupPhotoFront',
      'pickupPhotoBack',
      'pickupPhotoLeft',
      'pickupPhotoRight',
      'pickupPhotoWithVehicle',
    ];
    const pickupFields = getModelFields('RiderPickupPhoto');
    const riderFields = getModelFields('Rider');

    for (const f of legacyOnPickup) {
      it(`Rider.${f} is still present (gate for drop migration)`, () => {
        expect(riderFields).toContain(f);
      });
    }

    it('RiderPickupPhoto has matching fields (with name convention diff)', () => {
      // RiderPickupPhoto uses photoFront (not pickupPhotoFront).
      for (const f of legacyOnPickup) {
        const canonicalName = f.replace(/^pickupPhoto/, 'photo');
        expect(pickupFields).toContain(canonicalName);
      }
    });
  });

  describe('Rider legacy permission booleans (extracted to RiderPermission rows)', () => {
    const legacyPermissionBooleans = [
      'locationGranted',
      'batteryGranted',
      'contactsGranted',
      'callLogsGranted',
      'micGranted',
      'cameraGranted',
      'phoneGranted',
    ];
    const riderFields = getModelFields('Rider');

    for (const f of legacyPermissionBooleans) {
      it(`Rider.${f} is still present (gate for drop migration)`, () => {
        expect(riderFields).toContain(f);
      });
    }

    it('RiderPermission table exists with the 1:N shape', () => {
      const schema = readFileSync(SCHEMA_PATH, 'utf-8');
      expect(schema).toMatch(/model\s+RiderPermission\s*\{/);
      // 1:N shape: each row has riderId + permission + granted
      expect(schema).toMatch(/permission\s+String/);
      expect(schema).toMatch(/@@unique\(\[riderId,\s*permission\]\)/);
    });
  });

  describe('schema drift prevention (regression)', () => {
    it('Rider model still exists', () => {
      const schema = readFileSync(SCHEMA_PATH, 'utf-8');
      expect(schema).toMatch(/model\s+Rider\s*\{/);
    });

    it('RiderAdminLock model still exists', () => {
      const schema = readFileSync(SCHEMA_PATH, 'utf-8');
      expect(schema).toMatch(/model\s+RiderAdminLock\s*\{/);
    });

    it('RiderPickupPhoto model still exists', () => {
      const schema = readFileSync(SCHEMA_PATH, 'utf-8');
      expect(schema).toMatch(/model\s+RiderPickupPhoto\s*\{/);
    });

    it('RiderPermission model still exists', () => {
      const schema = readFileSync(SCHEMA_PATH, 'utf-8');
      expect(schema).toMatch(/model\s+RiderPermission\s*\{/);
    });
  });

  describe('drift-prevention: the 3 expand migrations are in the migration history', () => {
    it('extract_rider_permissions migration exists', () => {
      expect(existsSync(
        resolve(__dirname, '../../prisma/migrations/20260728000000_extract_rider_permissions')
      )).toBe(true);
    });

    it('extract_rider_admin_lock_and_pickup migration exists', () => {
      expect(existsSync(
        resolve(__dirname, '../../prisma/migrations/20260728000001_extract_rider_admin_lock_and_pickup')
      )).toBe(true);
    });
  });

  describe('PR-S drop migration is NOT yet present (gated on staging soak)', () => {
    it('no drop-legacy-rider-columns migration exists', () => {
      // The drop migration will be PR-S.2. It cannot ship until:
      //   1. The 1-wk staging soak of the ADD migrations completes
      //   2. All 80+ reader/writer lines across 12 files are migrated
      // Until then, this test should pass.
      const schema = readFileSync(SCHEMA_PATH, 'utf-8');
      // If the drop migration has been written, the legacy columns
      // would no longer be on Rider. So checking the schema for the
      // columns is the right gate.
      expect(schema).toMatch(/isAdminLocked\s+Boolean/);
      expect(schema).toMatch(/lockPasswordHash\s+String\?/);
      expect(schema).toMatch(/locationGranted\s+Boolean/);
      expect(schema).toMatch(/pickupPhotoFront\s+String\?/);
    });
  });
});
