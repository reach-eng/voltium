/**
 * Settings Registry — single source of truth for system_settings.
 *
 * Phase 2 PR-C item 4.4: this is the canonical list of valid
 * system_settings rows. Use-cases that read/write settings should
 * validate against this registry.
 *
 * STUB implementation. The real registry is built from settings/
 * use-cases. This stub provides the API surface that
 * tests/unit/settings-registry.test.ts expects.
 */

export type SettingType = 'BOOLEAN' | 'STRING' | 'NUMBER' | 'NUMBER_MONETARY';

export interface SettingMetadata {
  key: string;
  type: SettingType;
  defaultValue: boolean | number | string;
  isPublic: boolean;
  description?: string;
}

export const SETTING_REGISTRY: SettingMetadata[] = [
  {
    key: 'walletMinTopup',
    type: 'NUMBER_MONETARY',
    defaultValue: 100,
    isPublic: true,
    description: 'Minimum wallet top-up amount in rupees',
  },
  {
    key: 'gpsFetchIntervalMins',
    type: 'NUMBER',
    defaultValue: 5,
    isPublic: false,
    description: 'GPS fetch interval in minutes',
  },
  {
    key: 'autoApproveKYC',
    type: 'BOOLEAN',
    defaultValue: false,
    isPublic: false,
    description: 'Auto-approve KYC submissions',
  },
  {
    key: 'emailNotifications',
    type: 'BOOLEAN',
    defaultValue: true,
    isPublic: true,
    description: 'Send email notifications',
  },
  {
    key: 'smsNotifications',
    type: 'BOOLEAN',
    defaultValue: true,
    isPublic: true,
  },
  {
    key: 'lateFee',
    type: 'NUMBER_MONETARY',
    defaultValue: 50,
    isPublic: true,
  },
  {
    key: 'referralBonus',
    type: 'NUMBER_MONETARY',
    defaultValue: 100,
    isPublic: true,
  },
];

export const SETTINGS_BY_KEY: Map<string, SettingMetadata> = new Map(
  SETTING_REGISTRY.map((s) => [s.key, s])
);

export const DEFAULT_SETTINGS_MAP: Record<string, boolean | number | string> = Object.fromEntries(
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
): { value: unknown; type: SettingType } {
  const meta = SETTINGS_BY_KEY.get(key);
  if (!meta) {
    throw new Error(`Unknown setting key: ${key}`);
  }
  switch (meta.type) {
    case 'BOOLEAN':
      if (typeof value === 'boolean') return { value, type: meta.type };
      if (value === 'true' || value === '1' || value === 1) return { value: true, type: meta.type };
      if (value === 'false' || value === '0' || value === 0) return { value: false, type: meta.type };
      throw new Error(`Invalid boolean for ${key}: ${value}`);
    case 'NUMBER':
    case 'NUMBER_MONETARY': {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return { value, type: meta.type };
      }
      if (typeof value === 'string') {
        const n = Number(value);
        if (Number.isFinite(n)) return { value: n, type: meta.type };
      }
      throw new Error(`Invalid number for ${key}: ${value}`);
    }
    case 'STRING':
      return { value: String(value), type: meta.type };
  }
}

/**
 * Asserts that the database's system_settings rows are consistent
 * with the SETTING_REGISTRY. Logs warnings on drift.
 *
 * Used at server startup (see web/instrumentation.ts).
 */
export async function assertDbConsistency(): Promise<void> {
  // Lazy import to avoid circular dependency
  const { db } = await import('@/lib/db');
  const { logger } = await import('@/lib/logger');
  try {
    const rows = await db.systemSetting.findMany();
    for (const row of rows) {
      if (!isValidSettingKey(row.key)) {
        logger.warn(`[settings.registry] Unknown system_settings key: ${row.key}`);
      }
    }
  } catch (err) {
    logger.warn('[settings.registry] Drift check failed (DB unavailable?):', err);
  }
}
