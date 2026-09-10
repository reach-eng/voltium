/**
 * Settings Registry — single source of truth for system_settings.
 */

export type SettingType = 'BOOLEAN' | 'STRING' | 'NUMBER';

/**
 * 2026-09-08 configuration audit: domain-level rejection of a client-supplied
 * setting key/value (unknown key, type mismatch, non-finite, out of the
 * registry's min/max range). Throwing the plain `Error` this replaces made
 * every rejection indistinguishable from a server fault — both admin PUT
 * routes surfaced range violations as 500s instead of 400s.
 * `coerceSettingValue` throws this (and nothing else) for bad input;
 * `settingUseCases.update` throws it for read-only rows and unknown keys.
 * Messages are unchanged from the plain-Error era.
 */
export class SettingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingValidationError';
  }
}

export interface SettingMetadata {
  key: string;
  category: 'BUSINESS' | 'POLICY' | 'NOTIFICATION' | 'LOCATION' | string;
  valueType: SettingType;
  defaultValue: string;
  isPublic: boolean;
  isSecret?: boolean;
  isEditable?: boolean;
  /**
   * P1-3 (settings audit, 2026-09-08): optional inclusive range for
   * NUMBER settings, expressed in the SAME unit the API accepts —
   * rupees for BUSINESS keys (the client sends rupees; coercion
   * converts to paise afterwards), raw units for POLICY/LOCATION.
   * Enforced in `coerceSettingValue` (defense in depth behind the
   * UI's `type="number"` inputs).
   */
  min?: number;
  max?: number;
  description: string;
}

export const SETTING_REGISTRY: SettingMetadata[] = [
  {
    key: 'walletMinTopup',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '150000', // 1500 rupees in paise
    isPublic: true,
    min: 1, // rupees — a zero/negative floor would let ₹0 top-ups through
    max: 1000000, // rupees
    description: 'Minimum wallet top-up in paise',
  },
  {
    // PR-5 (2026-08-07 verification, Section 2 — Admin Config P1-6): the
    // System Settings UI renders walletMaxTopup / autoApproveTopupLimit /
    // referralBonusCap fields but they were missing from the registry, so
    // saving them silently failed (isValidSettingKey → unknown key).
    key: 'walletMaxTopup',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '5000000', // 50000 rupees in paise
    isPublic: true,
    min: 1, // rupees
    max: 10000000, // rupees
    description: 'Maximum allowed single wallet top-up in paise',
  },
  {
    key: 'autoApproveTopupLimit',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '500000', // 5000 rupees in paise
    isPublic: true,
    min: 0, // rupees — 0 legitimately disables auto-approval
    max: 10000000, // rupees
    description: 'Top-ups at or below this amount (paise) are auto-approved',
  },
  {
    key: 'referralBonusCap',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '1000000', // 10000 rupees in paise
    isPublic: true,
    min: 0, // rupees — 0 legitimately disables the bonus
    max: 10000000, // rupees
    description: 'Maximum referral bonus a single rider can earn in paise',
  },
  {
    key: 'lateFee',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '10000', // 100 rupees in paise
    isPublic: true,
    min: 0, // rupees — 0 legitimately disables the fee
    max: 100000, // rupees
    description: 'Late fee in paise',
  },
  {
    key: 'referralBonus',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '50000', // 500 rupees in paise
    isPublic: true,
    min: 0, // rupees — 0 legitimately disables the bonus
    max: 1000000, // rupees
    description: 'Referral bonus in paise',
  },
  {
    // P0-2 (system-settings audit, 2026-09-08): `dailyRent` was a live
    // per-day revenue figure with ONE writer — the raw-string
    // system-settings PUT — and ONE reader (`rental.use-cases.ts:236`,
    // `parseInt(value) || 18000`). The BUSINESS surface on the same
    // table rejected it as an unknown key, so the unvalidated
    // system-settings surface was the only path. Promoting it here:
    //   - the BUSINESS surface (multi-key, rupee-in, registry-coerced)
    //     becomes the validated writer,
    //   - the system-settings surface PUT allowlist refuses it
    //     (see `INFRA_PUT_ALLOWED_KEYS`),
    //   - the rental reader is unchanged (it still reads the raw
    //     paise string from the DB row) — its default of 18000 paise
    //     is now the registry's `defaultValue` too, so a missing row
    //     is consistent on both sides.
    key: 'dailyRent',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '18000', // 180 rupees in paise — matches rental.use-cases fallback
    isPublic: false,
    min: 1, // rupees — 0 would price rentals at zero
    max: 100000, // rupees — cap at ₹1,00,000/day to keep a fat-finger save from breaking pricing
    description: 'Base daily rental price in paise (legacy name: dailyRent). ' +
                 'PR-2 (system-settings audit, 2026-09-08) promoted this from the ' +
                 'raw-string system-settings surface to the validated BUSINESS registry.',
  },
  {
    key: 'skipGuarantorExtraDeposit',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '100000', // 1000 rupees in paise
    isPublic: true,
    min: 0, // rupees — 0 disables the extra deposit
    max: 1000000, // rupees
    description: 'Extra security deposit in paise required when guarantor is skipped',
  },
  {
    key: 'autoApproveKYC',
    category: 'POLICY',
    valueType: 'BOOLEAN',
    defaultValue: 'false',
    isPublic: false,
    description: 'Auto approve KYC submissions',
  },
  {
    key: 'gracePeriodHours',
    category: 'POLICY',
    valueType: 'NUMBER',
    defaultValue: '24',
    isPublic: false,
    min: 0, // hours — 0 means penalties apply immediately
    max: 24 * 30, // a month of grace is beyond reasonable
    description: 'Grace period in hours',
  },
  {
    key: 'emailNotifications',
    category: 'NOTIFICATION',
    valueType: 'BOOLEAN',
    defaultValue: 'true',
    isPublic: false,
    description: 'Enable email notifications',
  },
  {
    key: 'smsNotifications',
    category: 'NOTIFICATION',
    valueType: 'BOOLEAN',
    defaultValue: 'true',
    isPublic: false,
    description: 'Enable SMS notifications',
  },
  {
    key: 'gpsFetchIntervalMins',
    category: 'LOCATION',
    valueType: 'NUMBER',
    defaultValue: '10',
    isPublic: true,
    min: 1, // minutes — 0 would pin the rider's GPS at 100% duty cycle
    max: 1440, // a day
    description: 'GPS fetch interval in minutes',
  },
  {
    key: 'maxRentalDays',
    category: 'POLICY',
    valueType: 'NUMBER',
    defaultValue: '30',
    isPublic: true,
    min: 1, // days — 0 would make every rental instantly overdue
    max: 365,
    description: 'Maximum rental period in days',
  },
  {
    key: 'penaltyCapDays',
    category: 'POLICY',
    valueType: 'NUMBER',
    defaultValue: '7',
    isPublic: true,
    min: 0, // days — 0 caps penalties at the first day
    max: 365,
    description: 'Maximum penalty calculation period cap in days',
  },
  {
    key: 'walletOverdueReviewDays',
    category: 'POLICY',
    valueType: 'NUMBER',
    defaultValue: '3',
    isPublic: false,
    min: 1, // days
    max: 30,
    description: 'Days a rider can remain in negative balance before flagged for admin review',
  },
  {
    key: 'maxWalletBalance',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '1000000', // 10000 rupees in paise
    isPublic: true,
    min: 1, // rupees — 0 would block every top-up
    max: 10000000, // rupees
    description: 'Maximum allowed wallet balance in paise',
  },
  {
    key: 'loyaltyPointsPerRupee',
    category: 'POLICY',
    valueType: 'NUMBER',
    defaultValue: '1',
    isPublic: true,
    min: 0, // points — 0 legitimately disables earning
    max: 1000,
    description: 'Loyalty points awarded per rupee spent',
  },
  {
    key: 'supportEmail',
    category: 'NOTIFICATION',
    valueType: 'STRING',
    defaultValue: 'support@voltium.app',
    isPublic: true,
    description: 'Public customer support email address',
  },
  {
    key: 'supportPhone',
    category: 'NOTIFICATION',
    valueType: 'STRING',
    defaultValue: '+91 1800-889-VOLT',
    isPublic: true,
    description: 'Public customer support contact phone number',
  },
];

export const SETTINGS_BY_KEY: Map<string, SettingMetadata> = new Map(
  SETTING_REGISTRY.map((s) => [s.key, s])
);

export const DEFAULT_SETTINGS_MAP: Record<string, string> = Object.fromEntries(
  SETTING_REGISTRY.map((s) => [s.key, s.defaultValue])
);

export const PUBLIC_SETTING_KEYS: string[] = SETTING_REGISTRY.filter((s) => s.isPublic).map(
  (s) => s.key
);

export function isValidSettingKey(key: string): boolean {
  return SETTINGS_BY_KEY.has(key);
}

export function coerceSettingValue(
  key: string,
  value: unknown
): { stored: string; valueType: SettingType } {
  if (value === null || value === undefined) {
    throw new SettingValidationError(`Value for ${key} cannot be null or undefined`);
  }

  const meta = SETTINGS_BY_KEY.get(key);
  if (!meta) {
    throw new SettingValidationError(`Unknown setting key: ${key}`);
  }

  switch (meta.valueType) {
    case 'BOOLEAN': {
      if (typeof value === 'boolean') {
        return { stored: String(value), valueType: 'BOOLEAN' };
      }
      if (value === 'true' || value === 'false') {
        return { stored: value, valueType: 'BOOLEAN' };
      }
      throw new SettingValidationError(`Setting ${key} expects boolean, got ${typeof value}`);
    }
    case 'NUMBER': {
      let num: number;
      if (typeof value === 'number') {
        num = value;
      } else if (typeof value === 'string' && value.trim() !== '') {
        num = Number(value);
      } else {
        throw new Error(`Setting ${key} expects finite number, got ${typeof value}`);
      }

      if (!Number.isFinite(num)) {
        throw new Error(`Setting ${key} expects finite number, got ${num}`);
      }

      // P1-3 (settings audit, 2026-09-08): per-key range validation.
      // `walletMinTopup: -500`, `maxRentalDays: 0` used to persist.
      // Ranges are expressed in the API's unit (rupees for BUSINESS
      // keys, raw units otherwise) and enforced BEFORE the paise
      // conversion so error messages match what the admin typed.
      if (meta.min !== undefined && num < meta.min) {
        throw new SettingValidationError(
          `Setting ${key} must be >= ${meta.min} (got ${num})`
        );
      }
      if (meta.max !== undefined && num > meta.max) {
        throw new SettingValidationError(
          `Setting ${key} must be <= ${meta.max} (got ${num})`
        );
      }

      let storedNum = num;
      if (meta.category === 'BUSINESS') {
        // Convert rupees to paise.
        // CONFIG-AUDIT-2026-09-08 (P1-4): Math.round — `19.99 * 100` is
        // `1998.9999999999998` in IEEE-754; without rounding the stored
        // string carried float debris and every reader's parseInt truncated
        // ₹19.99 to ₹19.98 (the coupon module fixed this same bug first).
        // Fractional paise cannot be represented anyway, so rounding is the
        // only lossless-in-paise choice; inputs beyond 2 decimals round to
        // the nearest paise.
        storedNum = Math.round(num * 100);
      }

      return { stored: String(storedNum), valueType: 'NUMBER' };
    }
    case 'STRING': {
      const strValue = String(value);
      // CONFIG-AUDIT-2026-09-08 (P2-7): shape-check the contact strings —
      // a typo'd supportEmail ships to every rider surface. Numbers are
      // range-checked above; strings get the same scrutiny.
      if (key === 'supportEmail' && strValue.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue.trim())) {
        throw new SettingValidationError(`Setting ${key} must be a valid email address (got "${strValue.trim()}")`);
      }
      if (key === 'supportPhone' && strValue.trim() !== '' && !/^\+?[0-9][0-9\s-]{5,19}$/.test(strValue.trim())) {
        throw new SettingValidationError(`Setting ${key} must be a valid phone number (got "${strValue.trim()}")`);
      }
      return { stored: strValue, valueType: 'STRING' };
    }
  }
}

export async function assertDbConsistency(): Promise<{ drift: Array<{ key: string; expected: string; actual: string }>; checked: number }> {
  const { db } = await import('@/lib/db');
  const { logger } = await import('@/lib/logger');

  const drift: Array<{ key: string; expected: string; actual: string }> = [];
  let checked = 0;

  try {
    const rows = await db.systemSetting.findMany();
    for (const row of rows) {
      const meta = SETTINGS_BY_KEY.get(row.key);
      if (meta) {
        checked++;
        if (row.valueType !== meta.valueType) {
          drift.push({ key: row.key, expected: meta.valueType, actual: row.valueType });
          logger.warn(`[settings.registry] Drift for key ${row.key}: expected ${meta.valueType}, got ${row.valueType}`);
        }
      }
    }
  } catch (err) {
    logger.warn('[settings.registry] Drift check failed (DB unavailable?):', err);
  }

  return { drift, checked };
}
