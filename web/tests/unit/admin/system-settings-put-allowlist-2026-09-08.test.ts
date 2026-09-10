import { describe, it, expect } from 'vitest';
import {
  INFRA_PUT_ALLOWED_KEYS,
  managedElsewhere,
  validateInfraKey,
  auditActionForKey,
  isMaintenanceKey,
} from '../../../src/app/api/admin/system-settings/infra-key-validators';

/**
 * P0-2 (system-settings section audit, 2026-09-08) — contract test for
 * the PUT allowlist + per-key validators on the system-settings
 * surface. The route used to accept ANY existing editable key as a
 * raw string — a backdoor for free-text garbage on numeric / boolean
 * keys, a paise/rupee inversion landmine on business keys
 * (`referralBonus` raw paise vs rupee), and a `flag.*` bypass
 * (`flag.enableKYCVerification=maybe`).
 *
 * This test pins the new contract:
 *   1. `INFRA_PUT_ALLOWED_KEYS` contains exactly the 5 LIVE
 *      infrastructure keys.
 *   2. `managedElsewhere(key)` returns a human-readable hint for
 *      every category of refused key (business, flag, internal,
 *      dead-knob).
 *   3. `validateInfraKey(key, value)` returns the canonical value
 *      for each allowlisted key, and throws `SettingValidationError`
 *      on bad input (path traversal, non-boolean where BOOLEAN is
 *      expected, etc.).
 */

describe('system-settings PUT allowlist (P0-2, 2026-09-08)', () => {
  it('INFRA_PUT_ALLOWED_KEYS contains exactly the 5 live infra keys', () => {
    expect([...INFRA_PUT_ALLOWED_KEYS].sort()).toEqual([
      'BACKUP_ROOT',
      'BACKUP_SECONDARY_ROOT',
      'LOCAL_STORAGE_ROOT',
      'MAINTENANCE_MESSAGE',
      'MAINTENANCE_MODE',
    ]);
  });

  it('refuses BUSINESS-category keys with a /admin/settings pointer', () => {
    const hint = managedElsewhere('referralBonus');
    expect(hint).toMatch(/Business settings surface/);
    const hint2 = managedElsewhere('dailyRent');
    expect(hint2).toMatch(/Business settings surface/);
    const hint3 = managedElsewhere('walletMinTopup');
    expect(hint3).toMatch(/Business settings surface/);
  });

  it('refuses flag.* keys with a Feature Flags pointer', () => {
    expect(managedElsewhere('flag.enableKYCVerification')).toMatch(/Feature Flags/);
    expect(managedElsewhere('flag.somethingElse')).toMatch(/Feature Flags/);
  });

  it('refuses internal-lock keys (BACKUP_LOCK_*, job:*)', () => {
    expect(managedElsewhere('BACKUP_LOCK_STATUS')).toMatch(/internal lock/);
    expect(managedElsewhere('job:blobby-gc')).toMatch(/internal lock/);
  });

  it('refuses dead knobs (P0-1) with a read-only-display pointer', () => {
    expect(managedElsewhere('BACKUP_FREQUENCY')).toMatch(/read-only display/);
    expect(managedElsewhere('APP_PUBLIC_URL')).toMatch(/read-only display/);
    expect(managedElsewhere('API_BASE_URL')).toMatch(/read-only display/);
  });

  it('rejects unknown keys with a generic not-editable-from-here message', () => {
    const hint = managedElsewhere('somethingCustom');
    expect(hint).toMatch(/not editable from the System Settings surface/);
  });
});

describe('validateInfraKey — per-key validation', () => {
  it('LOCAL_STORAGE_ROOT: accepts an absolute path', () => {
    expect(validateInfraKey('LOCAL_STORAGE_ROOT', 'D:/VoltiumServer/data/uploads')).toBe(
      'D:/VoltiumServer/data/uploads'
    );
    expect(validateInfraKey('LOCAL_STORAGE_ROOT', '/var/lib/voltium/uploads')).toBe(
      '/var/lib/voltium/uploads'
    );
    expect(validateInfraKey('LOCAL_STORAGE_ROOT', '\\\\nas\\uploads')).toBe('\\\\nas\\uploads');
  });

  it('LOCAL_STORAGE_ROOT: rejects empty, relative, and traversal paths', () => {
    expect(() => validateInfraKey('LOCAL_STORAGE_ROOT', '')).toThrow(/cannot be empty/);
    expect(() => validateInfraKey('LOCAL_STORAGE_ROOT', 'uploads/relative')).toThrow(
      /must be an absolute path/
    );
    expect(() => validateInfraKey('LOCAL_STORAGE_ROOT', 'D:/data/../etc')).toThrow(/cannot contain "\.\."/);
  });

  it('BACKUP_ROOT: same rules as LOCAL_STORAGE_ROOT', () => {
    expect(validateInfraKey('BACKUP_ROOT', 'D:/VoltiumServer/data/backups')).toBe(
      'D:/VoltiumServer/data/backups'
    );
    expect(() => validateInfraKey('BACKUP_ROOT', 'relative/path')).toThrow(/absolute path/);
  });

  it('BACKUP_SECONDARY_ROOT: empty string is allowed to clear the optional destination (P2-3)', () => {
    expect(validateInfraKey('BACKUP_SECONDARY_ROOT', '')).toBe('');
    expect(validateInfraKey('BACKUP_SECONDARY_ROOT', 'D:/USB/backups')).toBe('D:/USB/backups');
  });

  it('MAINTENANCE_MODE: only accepts "true" / "false" literal strings', () => {
    expect(validateInfraKey('MAINTENANCE_MODE', 'true')).toBe('true');
    expect(validateInfraKey('MAINTENANCE_MODE', 'false')).toBe('false');
    expect(() => validateInfraKey('MAINTENANCE_MODE', '1')).toThrow(/must be "true" or "false"/);
    expect(() => validateInfraKey('MAINTENANCE_MODE', 'TRUE')).toThrow(/must be "true" or "false"/);
    expect(() => validateInfraKey('MAINTENANCE_MODE', 'maybe')).toThrow(/must be "true" or "false"/);
  });

  it('MAINTENANCE_MESSAGE: enforces a 500-character max', () => {
    expect(validateInfraKey('MAINTENANCE_MESSAGE', 'short msg')).toBe('short msg');
    const long = 'x'.repeat(501);
    expect(() => validateInfraKey('MAINTENANCE_MESSAGE', long)).toThrow(/500 characters or fewer/);
    const exactly500 = 'x'.repeat(500);
    expect(validateInfraKey('MAINTENANCE_MESSAGE', exactly500)).toBe(exactly500);
  });

  it('refuses a non-allowlisted key', () => {
    expect(() => validateInfraKey('dailyRent', '50000')).toThrow(/Business settings surface/);
    expect(() => validateInfraKey('referralBonus', '50000')).toThrow(/Business settings surface/);
    expect(() => validateInfraKey('BACKUP_FREQUENCY', 'DAILY')).toThrow(/read-only display/);
  });
});

// ---------------------------------------------------------------------------
// P1-2 (system-settings audit, 2026-09-08) — maintenance writes
// (MAINTENANCE_MODE / MAINTENANCE_MESSAGE) must:
//   1. Emit the same audit action names as the dedicated maintenance
//      route (so a single toggle from either surface shows up under
//      a single action).
//   2. Invalidate the middleware's in-memory maintenance cache so the
//      rider gate reflects the change instantly (not after the 5s
//      TTL). The dedicated maintenance route already does this; the
//      system-settings surface historically skipped it.
// ---------------------------------------------------------------------------

describe('P1-2: maintenance audit action names', () => {
  it('MAINTENANCE_MODE="true" → MAINTENANCE_ENABLED', () => {
    expect(auditActionForKey('MAINTENANCE_MODE', 'true')).toBe('MAINTENANCE_ENABLED');
  });

  it('MAINTENANCE_MODE="false" → MAINTENANCE_DISABLED', () => {
    expect(auditActionForKey('MAINTENANCE_MODE', 'false')).toBe('MAINTENANCE_DISABLED');
  });

  it('MAINTENANCE_MESSAGE → maintenance.message_updated (any value)', () => {
    expect(auditActionForKey('MAINTENANCE_MESSAGE', 'short banner')).toBe('maintenance.message_updated');
    expect(auditActionForKey('MAINTENANCE_MESSAGE', '')).toBe('maintenance.message_updated');
  });

  it('non-maintenance keys keep the generic system.config action', () => {
    expect(auditActionForKey('LOCAL_STORAGE_ROOT', 'D:/data')).toBe('system.config');
    expect(auditActionForKey('BACKUP_ROOT', 'D:/backups')).toBe('system.config');
    expect(auditActionForKey('BACKUP_SECONDARY_ROOT', '')).toBe('system.config');
  });

  it('matches the dedicated maintenance route\'s action names', () => {
    // The dedicated route (`/api/admin/maintenance-mode`) emits
    // MAINTENANCE_ENABLED / MAINTENANCE_DISABLED on PUT and
    // maintenance.message_updated on PATCH. The system-settings
    // surface now emits the same names, so a single toggle from
    // either surface shows up under a single action in the audit log.
    expect(auditActionForKey('MAINTENANCE_MODE', 'true')).toBe('MAINTENANCE_ENABLED');
    expect(auditActionForKey('MAINTENANCE_MODE', 'false')).toBe('MAINTENANCE_DISABLED');
  });
});

describe('P1-2: isMaintenanceKey — which keys drop the cache', () => {
  it('returns true for the two maintenance keys', () => {
    expect(isMaintenanceKey('MAINTENANCE_MODE')).toBe(true);
    expect(isMaintenanceKey('MAINTENANCE_MESSAGE')).toBe(true);
  });

  it('returns false for everything else (storage, URLs, etc.)', () => {
    expect(isMaintenanceKey('LOCAL_STORAGE_ROOT')).toBe(false);
    expect(isMaintenanceKey('BACKUP_ROOT')).toBe(false);
    expect(isMaintenanceKey('BACKUP_SECONDARY_ROOT')).toBe(false);
    // And — the critical case — for the dead knobs from PR-1 that
    // are still in the table as `isEditable: false`. The route
    // refuses them with 400 before this point, but the helper
    // returning false means even a future re-enable wouldn't
    // accidentally call invalidateMaintenanceCache() on a non-
    // maintenance key.
    expect(isMaintenanceKey('BACKUP_FREQUENCY')).toBe(false);
    expect(isMaintenanceKey('APP_PUBLIC_URL')).toBe(false);
  });
});
