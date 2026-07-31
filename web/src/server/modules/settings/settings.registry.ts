/**
 * Settings Registry — single source of truth for system_settings schema.
 *
 * Why this exists:
 *   - Prior to this registry, the list of valid setting keys lived in THREE
 *     places: lib/validators.ts (VALID_SETTING_KEYS, missing gpsFetchIntervalMins),
 *     server/modules/settings/setting.use-cases.ts (MONETARY_KEYS + PUBLIC_SETTINGS
 *     hardcoded sets), and inline DEFAULT_SETTINGS. Any new setting required
 *     touching all three. This caused drift (gpsFetchIntervalMins is in the
 *     use-case's PUBLIC_SETTINGS but not in VALID_SETTING_KEYS, so the admin
 *     validator rejects it).
 *
 * What this provides:
 *   - SETTING_REGISTRY: the full schema for every known setting (key, type,
 *     default, category, public flag, description).
 *   - SETTINGS_BY_KEY: O(1) lookup by key.
 *   - DEFAULT_SETTINGS_MAP: defaults for the getAll() use-case.
 *   - PUBLIC_SETTING_KEYS: subset exposed to the rider app.
 *   - isValidSettingKey / coerceSettingValue: type-safe validation for updates.
 *   - assertDbConsistency: startup-time check that the DB's stored valueType
 *     matches the registry's declared type.
 *
 * To add a new setting: append a SettingMeta to SETTING_REGISTRY below. The
 * validator, the use-case, and the public/private list all derive from this
 * single source.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ValidationError } from "@/lib/api-error";

export type SettingValueType = 'STRING' | 'NUMBER' | 'BOOLEAN';

export type SettingCategory =
  | 'BUSINESS'
  | 'COMMUNICATION'
  | 'LOCATION'
  | 'POLICY'
  | 'NOTIFICATION';

export interface SettingMeta {
  /** Unique key stored in system_settings.key. */
  key: string;
  /**
   * Default value as a string. Always stored as a string in the DB; the
   * declared `valueType` controls coercion at read time.
   */
  defaultValue: string;
  /** Declared storage type. Must match the DB row's valueType column. */
  valueType: SettingValueType;
  category: SettingCategory;
  /** True if the setting is safe to expose to the rider app via /api/rider/settings. */
  isPublic: boolean;
  /** Human-readable description (used by the admin settings UI). */
  description: string;
}

// ---------------------------------------------------------------------------
// The registry itself.
// ---------------------------------------------------------------------------

export const SETTING_REGISTRY: readonly SettingMeta[] = [
  {
    key: 'walletMinTopup',
    defaultValue: '150000',
    valueType: 'NUMBER',
    category: 'BUSINESS',
    isPublic: true,
    description: 'Minimum wallet top-up amount, in paise (150000 = ₹1500).',
  },
  {
    key: 'lateFee',
    defaultValue: '10000',
    valueType: 'NUMBER',
    category: 'BUSINESS',
    isPublic: true,
    description: 'Late fee charged per overdue rental day, in paise (10000 = ₹100).',
  },
  {
    key: 'referralBonus',
    defaultValue: '20000',
    valueType: 'NUMBER',
    category: 'BUSINESS',
    isPublic: true,
    description: 'Referral bonus amount, in paise (20000 = ₹200).',
  },
  {
    key: 'autoApproveKYC',
    defaultValue: 'false',
    valueType: 'BOOLEAN',
    category: 'POLICY',
    isPublic: false,
    description: 'When true, KYC submissions are auto-approved without admin review.',
  },
  {
    key: 'gracePeriodHours',
    defaultValue: '24',
    valueType: 'NUMBER',
    category: 'POLICY',
    isPublic: false,
    description: 'Hours after due date before late fees begin accruing.',
  },
  {
    key: 'emailNotifications',
    defaultValue: 'true',
    valueType: 'BOOLEAN',
    category: 'NOTIFICATION',
    isPublic: false,
    description: 'Master switch for outbound email notifications.',
  },
  {
    key: 'smsNotifications',
    defaultValue: 'true',
    valueType: 'BOOLEAN',
    category: 'NOTIFICATION',
    isPublic: false,
    description: 'Master switch for outbound SMS notifications.',
  },
  {
    key: 'gpsFetchIntervalMins',
    defaultValue: '10',
    valueType: 'NUMBER',
    category: 'LOCATION',
    isPublic: true,
    description: 'Interval (in minutes) at which the rider app reports GPS location.',
  },
] as const;

// ---------------------------------------------------------------------------
// Derived indexes
// ---------------------------------------------------------------------------

export const SETTINGS_BY_KEY: ReadonlyMap<string, SettingMeta> = new Map(
  SETTING_REGISTRY.map((s) => [s.key, s] as const)
);

export const DEFAULT_SETTINGS_MAP: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(SETTING_REGISTRY.map((s) => [s.key, s.defaultValue]))
);

export const PUBLIC_SETTING_KEYS: readonly string[] = SETTING_REGISTRY.filter(
  (s) => s.isPublic
).map((s) => s.key);

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** True if the key is known to the registry. */
export function isValidSettingKey(key: string): boolean {
  return SETTINGS_BY_KEY.has(key);
}

/**
 * Throws if the value cannot be represented as the declared type.
 * Returns the canonical string form to store in the DB.
 *
 * For NUMBER (monetary) keys, the value is in **rupees** at the API boundary
 * and must be converted to **paise** before storage. We detect monetary keys
 * by category === 'BUSINESS' + valueType === 'NUMBER' — these are the keys
 * that were historically tagged as MONETARY_KEYS in the use-case.
 */
export function coerceSettingValue(
  key: string,
  value: unknown
): { stored: string; valueType: SettingValueType } {
  const meta = SETTINGS_BY_KEY.get(key);
  if (!meta) {
    throw new ValidationError(`Unknown setting key: ${key}`);
  }

  if (value === null || value === undefined) {
    throw new ValidationError(`Setting ${key} cannot be null or undefined`);
  }

  switch (meta.valueType) {
    case 'BOOLEAN': {
      // Accept 'true' / 'false' / true / false; reject anything else
      if (typeof value === 'boolean') {
        return { stored: value ? 'true' : 'false', valueType: 'BOOLEAN' };
      }
      if (typeof value === 'string' && (value === 'true' || value === 'false')) {
        return { stored: value, valueType: 'BOOLEAN' };
      }
      throw new ValidationError(
        `Setting ${key} expects boolean, got ${typeof value}: ${String(value)}`
      );
    }
    case 'NUMBER': {
      const num = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(num)) {
        throw new ValidationError(
          `Setting ${key} expects a finite number, got: ${String(value)}`
        );
      }
      // Monetary keys (category BUSINESS + NUMBER) are entered in RUPEES at
      // the API layer; convert to PAISE for storage.
      const isMonetary = meta.category === 'BUSINESS';
      const stored = String(isMonetary ? Math.round(num * 100) : Math.round(num));
      return { stored, valueType: 'NUMBER' };
    }
    case 'STRING': {
      const s = typeof value === 'string' ? value : String(value);
      return { stored: s, valueType: 'STRING' };
    }
  }
}

// ---------------------------------------------------------------------------
// Startup-time consistency check
// ---------------------------------------------------------------------------

/**
 * Verifies that the DB's stored valueType for each known setting matches
 * the registry. Logs a warning per mismatch. Does NOT throw — drift in
 * legacy data should be visible but not crash the server.
 *
 * Intended to be called from a startup hook (e.g. instrumentation.ts).
 * Idempotent; safe to call multiple times.
 */
export async function assertDbConsistency(): Promise<{
  checked: number;
  drift: Array<{ key: string; expected: SettingValueType; actual: string }>;
}> {
  try {
    const dbRows = await db.systemSetting.findMany({
      where: { key: { in: Array.from(SETTINGS_BY_KEY.keys()) } },
      select: { key: true, valueType: true },
    });

    const drift: Array<{ key: string; expected: SettingValueType; actual: string }> = [];
    for (const row of dbRows) {
      const meta = SETTINGS_BY_KEY.get(row.key);
      if (!meta) continue;
      if (row.valueType !== meta.valueType) {
        drift.push({
          key: row.key,
          expected: meta.valueType,
          actual: row.valueType,
        });
      }
    }

    if (drift.length > 0) {
      logger.warn(
        `[SettingsRegistry] DB valueType drift detected for ${drift.length} setting(s): ` +
          drift
            .map((d) => `${d.key} (expected ${d.expected}, got ${d.actual})`)
            .join(', ')
      );
    } else {
      logger.debug(
        `[SettingsRegistry] DB consistency check passed for ${dbRows.length} setting(s).`
      );
    }
    return { checked: dbRows.length, drift };
  } catch (err) {
    // DB unavailable in some contexts (build-time, certain tests). Don't crash.
    logger.warn('[SettingsRegistry] assertDbConsistency skipped:', err);
    return { checked: 0, drift: [] };
  }
}
