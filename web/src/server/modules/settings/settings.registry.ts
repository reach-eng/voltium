/**
 * Settings Registry — single source of truth for system_settings.
 */

export type SettingType = 'BOOLEAN' | 'STRING' | 'NUMBER';

export interface SettingMetadata {
  key: string;
  category: 'BUSINESS' | 'POLICY' | 'NOTIFICATION' | 'LOCATION' | string;
  valueType: SettingType;
  defaultValue: string;
  isPublic: boolean;
  description: string;
}

export const SETTING_REGISTRY: SettingMetadata[] = [
  {
    key: 'walletMinTopup',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '150000', // 1500 rupees in paise
    isPublic: true,
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
    description: 'Maximum allowed single wallet top-up in paise',
  },
  {
    key: 'autoApproveTopupLimit',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '500000', // 5000 rupees in paise
    isPublic: true,
    description: 'Top-ups at or below this amount (paise) are auto-approved',
  },
  {
    key: 'referralBonusCap',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '1000000', // 10000 rupees in paise
    isPublic: true,
    description: 'Maximum referral bonus a single rider can earn in paise',
  },
  {
    key: 'lateFee',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '10000', // 100 rupees in paise
    isPublic: true,
    description: 'Late fee in paise',
  },
  {
    key: 'referralBonus',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '20000', // 200 rupees in paise
    isPublic: true,
    description: 'Referral bonus in paise',
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
    description: 'GPS fetch interval in minutes',
  },
  {
    key: 'maxRentalDays',
    category: 'POLICY',
    valueType: 'NUMBER',
    defaultValue: '30',
    isPublic: true,
    description: 'Maximum rental period in days',
  },
  {
    key: 'penaltyCapDays',
    category: 'POLICY',
    valueType: 'NUMBER',
    defaultValue: '7',
    isPublic: true,
    description: 'Maximum penalty calculation period cap in days',
  },
  {
    key: 'maxWalletBalance',
    category: 'BUSINESS',
    valueType: 'NUMBER',
    defaultValue: '1000000', // 10000 rupees in paise
    isPublic: true,
    description: 'Maximum allowed wallet balance in paise',
  },
  {
    key: 'loyaltyPointsPerRupee',
    category: 'POLICY',
    valueType: 'NUMBER',
    defaultValue: '1',
    isPublic: true,
    description: 'Loyalty points awarded per rupee spent',
  },
  {
    key: 'supportEmail',
    category: 'NOTIFICATION',
    valueType: 'STRING',
    defaultValue: 'support@voltium.io',
    isPublic: true,
    description: 'Public customer support email address',
  },
  {
    key: 'supportPhone',
    category: 'NOTIFICATION',
    valueType: 'STRING',
    defaultValue: '+91 80000 00000',
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
    throw new Error(`Value for ${key} cannot be null or undefined`);
  }

  const meta = SETTINGS_BY_KEY.get(key);
  if (!meta) {
    throw new Error(`Unknown setting key: ${key}`);
  }

  switch (meta.valueType) {
    case 'BOOLEAN': {
      if (typeof value === 'boolean') {
        return { stored: String(value), valueType: 'BOOLEAN' };
      }
      if (value === 'true' || value === 'false') {
        return { stored: value, valueType: 'BOOLEAN' };
      }
      throw new Error(`Setting ${key} expects boolean, got ${typeof value}`);
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

      let storedNum = num;
      if (meta.category === 'BUSINESS') {
        // Convert rupees to paise
        storedNum = num * 100;
      }

      return { stored: String(storedNum), valueType: 'NUMBER' };
    }
    case 'STRING': {
      return { stored: String(value), valueType: 'STRING' };
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
