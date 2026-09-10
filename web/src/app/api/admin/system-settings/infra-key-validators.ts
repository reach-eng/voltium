/**
 * P0-2 (system-settings audit, 2026-09-08) — per-key validators for
 * the INFRASTRUCTURE surface. The shared `system_settings` table is
 * also written by the BUSINESS surface (which uses `coerceSettingValue`
 * with full registry coverage), and the audit found 5 live infra
 * editable keys after PR-1's freeze: `LOCAL_STORAGE_ROOT`,
 * `BACKUP_ROOT`, `BACKUP_SECONDARY_ROOT`, `MAINTENANCE_MODE`,
 * `MAINTENANCE_MESSAGE`. The system-settings route previously accepted
 * ANY of these as raw strings — a backdoor for free-text garbage on
 * numeric/boolean keys and a paise/rupee inversion landmine on
 * business keys (already closed by the allowlist, see
 * `INFRA_PUT_ALLOWED_KEYS`).
 *
 * Each validator returns the canonical stored value (or throws a
 * `SettingValidationError` from `@/server/modules/settings/settings.registry`).
 * The route wraps these in `errors.validation(...)` at the API boundary.
 *
 * `BACKUP_SECONDARY_ROOT` is allowed to be cleared to '' — see P2-3.
 * `MAINTENANCE_MODE` only accepts 'true' / 'false' literal strings
 * (matches the seed). Everything else requires non-empty input.
 */

import { SettingValidationError } from '@/server/modules/settings/settings.registry';

/** Keys the system-settings PUT will accept. Everything else is refused
 *  with 400 + "managed on /admin/settings" (for business / flag.* /
 *  legacy keys) or 404 (for unknown). */
export const INFRA_PUT_ALLOWED_KEYS = new Set<string>([
  'LOCAL_STORAGE_ROOT',
  'BACKUP_ROOT',
  'BACKUP_SECONDARY_ROOT',
  'MAINTENANCE_MODE',
  'MAINTENANCE_MESSAGE',
]);

/** Keys whose category is managed on the Business surface — used for
 *  the human-readable error message on rejection. */
const BUSINESS_SURFACE_KEY = new Set<string>([
  'referralBonus',
  'lateFee',
  'walletMinTopup',
  'walletMaxTopup',
  'walletOverdueReviewDays',
  'autoApproveKYC',
  'autoApproveTopupLimit',
  'referralBonusCap',
  'skipGuarantorExtraDeposit',
  'maxWalletBalance',
  'maxRentalDays',
  'penaltyCapDays',
  'loyaltyPointsPerRupee',
  'gracePeriodHours',
  'gpsFetchIntervalMins',
  'supportEmail',
  'supportPhone',
  'emailNotifications',
  'smsNotifications',
  // P0-2 audit: `dailyRent` is the only key with a live reader that
  // ever went through this surface — promoted to the business
  // registry in PR-2 so its writes are validated.
  'dailyRent',
  'weeklyRent',
  'monthlyRent',
  'securityDeposit',
]);

/** Human-readable surface hint when a key is refused. */
export function managedElsewhere(key: string): string {
  if (BUSINESS_SURFACE_KEY.has(key)) {
    return `Setting "${key}" is managed on the Business settings surface (/admin/settings).`;
  }
  if (key.startsWith('flag.')) {
    return `Setting "${key}" is a feature flag — managed on the Feature Flags tab.`;
  }
  if (key.startsWith('BACKUP_LOCK_') || key.startsWith('job:')) {
    return `Setting "${key}" is an internal lock and cannot be edited from the UI.`;
  }
  if (key === 'BACKUP_FREQUENCY' || key === 'BACKUP_TIME_OF_DAY' || key === 'BACKUP_TIMEZONE' ||
      key.startsWith('BACKUP_KEEP_') || key === 'BACKUP_MINIMUM_FREE_DISK_GB' ||
      key === 'APP_PUBLIC_URL' || key === 'API_BASE_URL') {
    return `Setting "${key}" is a read-only display — see the description for the active surface.`;
  }
  return `Setting "${key}" is not editable from the System Settings surface.`;
}

/** Validate and canonicalize the value for a known infra key. */
export function validateInfraKey(key: string, value: string): string {
  if (!INFRA_PUT_ALLOWED_KEYS.has(key)) {
    throw new SettingValidationError(managedElsewhere(key));
  }
  const trimmed = value.trim();
  switch (key) {
    case 'LOCAL_STORAGE_ROOT':
    case 'BACKUP_ROOT':
      return validatePath(trimmed, key);
    case 'BACKUP_SECONDARY_ROOT':
      // P2-3 (audit, 2026-09-08): allow empty string to clear the
      // optional secondary destination. Required roots still reject
      // empty via `validatePath` above.
      if (trimmed === '') return '';
      return validatePath(trimmed, key);
    case 'MAINTENANCE_MODE':
      if (trimmed !== 'true' && trimmed !== 'false') {
        throw new SettingValidationError(
          `Setting ${key} must be "true" or "false" (got "${trimmed}")`
        );
      }
      return trimmed;
    case 'MAINTENANCE_MESSAGE':
      if (trimmed.length > 500) {
        throw new SettingValidationError(
          `Setting ${key} must be 500 characters or fewer (got ${trimmed.length})`
        );
      }
      return trimmed;
    default:
      // INFRA_PUT_ALLOWED_KEYS guards above, so this is unreachable.
      throw new SettingValidationError(`Setting "${key}" is not editable from this surface`);
  }
}

function validatePath(value: string, key: string): string {
  if (value === '') {
    throw new SettingValidationError(`Setting ${key} cannot be empty`);
  }
  // Block path traversal — operators should not be able to point
  // BACKUP_ROOT at a parent of the storage area. This is a
  // defense-in-depth check; the builder already strips traversal
  // sequences, but a frozen root earlier in the chain is cheaper to
  // reject than a 403-on-write at runtime.
  if (value.includes('..')) {
    throw new SettingValidationError(
      `Setting ${key} cannot contain ".." path segments (got "${value}")`
    );
  }
  // Windows + POSIX absolute paths: starts with a drive letter, UNC, or '/'.
  if (!/^([A-Za-z]:[\\/]|[\\/]|[\\/]{2})/.test(value)) {
    throw new SettingValidationError(
      `Setting ${key} must be an absolute path (got "${value}")`
    );
  }
  return value;
}

/** P1-2 (system-settings audit, 2026-09-08): the audit action name
 *  for a given system-settings PUT. Mirrors the dedicated maintenance
 *  route (`MAINTENANCE_ENABLED` / `MAINTENANCE_DISABLED` /
 *  `maintenance.message_updated`) so a single toggle from either
 *  surface shows up under a single action in the audit log. Other
 *  keys continue to use the generic `system.config`. Exported for
 *  testability. */
export function auditActionForKey(key: string, newValue: string): string {
  if (key === 'MAINTENANCE_MODE') {
    if (newValue === 'true') return 'MAINTENANCE_ENABLED';
    if (newValue === 'false') return 'MAINTENANCE_DISABLED';
  } else if (key === 'MAINTENANCE_MESSAGE') {
    return 'maintenance.message_updated';
  }
  return 'system.config';
}

/** P1-2: does this key require `invalidateMaintenanceCache()` after
 *  the write? Maintenance keys do; everything else doesn't. */
export function isMaintenanceKey(key: string): boolean {
  return key === 'MAINTENANCE_MODE' || key === 'MAINTENANCE_MESSAGE';
}
