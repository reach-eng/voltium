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
