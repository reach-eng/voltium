/**
 * Settings Registry — single source of truth for expected valueType per key.
 *
 * Used by `validateSettingsConsistency()` at worker startup to catch
 * mismatches between the codebase's expectations and the database.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

/** Valid valueType values that the system recognizes. */
export const VALID_VALUE_TYPES = new Set([
  'STRING',
  'NUMBER',
  'BOOLEAN',
  'URL',
  'PATH',
]);

/**
 * Canonical type map for known setting keys.
 * Keys not in this map are still validated for valueType membership
 * in VALID_VALUE_TYPES, but not for type mismatch.
 */
export const SETTINGS_REGISTRY: Record<string, { valueType: string; category: string }> = {
  // Business settings
  walletMinTopup:       { valueType: 'NUMBER',  category: 'BUSINESS' },
  lateFee:              { valueType: 'NUMBER',  category: 'BUSINESS' },
  referralBonus:        { valueType: 'NUMBER',  category: 'BUSINESS' },
  autoApproveKYC:       { valueType: 'BOOLEAN', category: 'BUSINESS' },
  gracePeriodHours:     { valueType: 'NUMBER',  category: 'BUSINESS' },
  emailNotifications:   { valueType: 'BOOLEAN', category: 'BUSINESS' },
  smsNotifications:     { valueType: 'BOOLEAN', category: 'BUSINESS' },
  gpsFetchIntervalMins: { valueType: 'NUMBER',  category: 'BUSINESS' },

  // Server settings
  MAINTENANCE_MODE:    { valueType: 'BOOLEAN', category: 'SERVER' },
  MAINTENANCE_MESSAGE: { valueType: 'STRING',  category: 'SERVER' },

  // App URLs
  APP_PUBLIC_URL: { valueType: 'URL', category: 'APP_URLS' },
  API_BASE_URL:   { valueType: 'URL', category: 'APP_URLS' },

  // Storage paths
  LOCAL_STORAGE_ROOT:        { valueType: 'PATH', category: 'STORAGE' },
  BACKUP_ROOT:               { valueType: 'PATH', category: 'STORAGE' },
  BACKUP_SECONDARY_ROOT:     { valueType: 'PATH', category: 'STORAGE' },

  // Backup config
  BACKUP_KEEP_DAILY:             { valueType: 'NUMBER', category: 'BACKUP' },
  BACKUP_KEEP_WEEKLY:            { valueType: 'NUMBER', category: 'BACKUP' },
  BACKUP_KEEP_MONTHLY:           { valueType: 'NUMBER', category: 'BACKUP' },
  BACKUP_MINIMUM_FREE_DISK_GB:   { valueType: 'NUMBER', category: 'BACKUP' },
};

/**
 * Validate that system_settings valueType values are consistent with
 * the registry. Logs warnings for mismatches — does NOT throw, so a
 * misconfigured setting never blocks startup.
 *
 * Call this once at worker boot or from a health-check endpoint.
 */
export async function validateSettingsConsistency(): Promise<{
  checked: number;
  mismatches: Array<{ key: string; expected: string; actual: string }>;
  unknownTypes: Array<{ key: string; valueType: string }>;
}> {
  const mismatches: Array<{ key: string; expected: string; actual: string }> = [];
  const unknownTypes: Array<{ key: string; valueType: string }> = [];

  let rows: Array<{ key: string; valueType: string }>;
  try {
    rows = await db.systemSetting.findMany({
      select: { key: true, valueType: true },
    });
  } catch (err) {
    logger.warn('[SettingsRegistry] Could not query system_settings — skipping validation', {
      error: String(err),
    });
    return { checked: 0, mismatches: [], unknownTypes: [] };
  }

  for (const row of rows) {
    // Check valueType is a known enum value
    if (!VALID_VALUE_TYPES.has(row.valueType)) {
      unknownTypes.push({ key: row.key, valueType: row.valueType });
      continue;
    }

    // Check against registry if key is known
    const expected = SETTINGS_REGISTRY[row.key];
    if (expected && expected.valueType !== row.valueType) {
      mismatches.push({
        key: row.key,
        expected: expected.valueType,
        actual: row.valueType,
      });
    }
  }

  if (mismatches.length > 0) {
    logger.warn('[SettingsRegistry] valueType mismatches detected', { mismatches });
  }
  if (unknownTypes.length > 0) {
    logger.warn('[SettingsRegistry] Unknown valueType values in database', { unknownTypes });
  }
  if (mismatches.length === 0 && unknownTypes.length === 0) {
    logger.info('[SettingsRegistry] All settings consistent', { checked: rows.length });
  }

  return { checked: rows.length, mismatches, unknownTypes };
}
