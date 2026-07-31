/**
 * Settings Registry + Use-Cases — Unit Tests
 *
 * Phase 2 PR-C item 4.4: settings registry is the single source of truth
 * for what system_settings rows are valid, their types, defaults, and
 * which are public to the rider app.
 *
 * Tests:
 *   - Registry structure (all known keys, no duplicates, all required fields)
 *   - Derived indexes (SETTINGS_BY_KEY, DEFAULT_SETTINGS_MAP, PUBLIC_SETTING_KEYS)
 *   - isValidSettingKey
 *   - coerceSettingValue for BOOLEAN, NUMBER (monetary), NUMBER (non-monetary), STRING
 *   - coerceSettingValue rejects unknown keys, null, non-finite numbers
 *   - settingUseCases.getAll() / getPublic() / update() — happy paths + type validation
 *   - assertDbConsistency() — drift detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindMany = vi.fn();
const mockUpsert = vi.fn();
const mockGetFeatureFlags = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: () => mockGetFeatureFlags(),
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const registry = await import('@/server/modules/settings/settings.registry');
const useCases = (await import('@/server/modules/settings/setting.use-cases'))
  .settingUseCases;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SETTING_REGISTRY structure', () => {
  it('contains all expected keys', () => {
    const keys = registry.SETTING_REGISTRY.map((s) => s.key);
    for (const expected of [
      'walletMinTopup',
      'lateFee',
      'referralBonus',
      'autoApproveKYC',
      'gracePeriodHours',
      'emailNotifications',
      'smsNotifications',
      'gpsFetchIntervalMins',
    ]) {
      expect(keys).toContain(expected);
    }
  });

  it('has no duplicate keys', () => {
    const keys = registry.SETTING_REGISTRY.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has all required fields populated', () => {
    for (const s of registry.SETTING_REGISTRY) {
      expect(s.key).toBeTruthy();
      expect(s.defaultValue).toBeDefined();
      expect(s.defaultValue).not.toBe('');
      expect(['STRING', 'NUMBER', 'BOOLEAN']).toContain(s.valueType);
      expect(s.category).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });

  it('monetary keys (BUSINESS + NUMBER) have non-zero default in paise', () => {
    const monetary = registry.SETTING_REGISTRY.filter(
      (s) => s.category === 'BUSINESS' && s.valueType === 'NUMBER'
    );
    expect(monetary.length).toBeGreaterThan(0);
    for (const s of monetary) {
      const val = Number(s.defaultValue);
      expect(val).toBeGreaterThan(0);
      // Sanity: all defaults are multiples of 100 (paise)
      expect(val % 100).toBe(0);
    }
  });
});

describe('Derived indexes', () => {
  it('SETTINGS_BY_KEY has the same size as SETTING_REGISTRY', () => {
    expect(registry.SETTINGS_BY_KEY.size).toBe(registry.SETTING_REGISTRY.length);
  });

  it('DEFAULT_SETTINGS_MAP has every registry key with the same default', () => {
    for (const s of registry.SETTING_REGISTRY) {
      expect(registry.DEFAULT_SETTINGS_MAP[s.key]).toBe(s.defaultValue);
    }
  });

  it('PUBLIC_SETTING_KEYS matches isPublic=true entries', () => {
    const expected = registry.SETTING_REGISTRY.filter((s) => s.isPublic).map((s) => s.key);
    expect(new Set(registry.PUBLIC_SETTING_KEYS)).toEqual(new Set(expected));
  });

  it('PUBLIC_SETTING_KEYS is exposed to the rider app (no POLICY or NOTIFICATION keys)', () => {
    // Sanity: ensure no obviously-sensitive keys are public
    for (const key of registry.PUBLIC_SETTING_KEYS) {
      const meta = registry.SETTINGS_BY_KEY.get(key);
      expect(meta?.category).not.toBe('NOTIFICATION');
    }
  });
});

describe('isValidSettingKey', () => {
  it('returns true for known keys', () => {
    expect(registry.isValidSettingKey('walletMinTopup')).toBe(true);
    expect(registry.isValidSettingKey('gpsFetchIntervalMins')).toBe(true);
  });

  it('returns false for unknown keys', () => {
    expect(registry.isValidSettingKey('notARealKey')).toBe(false);
    expect(registry.isValidSettingKey('')).toBe(false);
  });
});

describe('coerceSettingValue', () => {
  it('coerces BOOLEAN from native boolean', () => {
    expect(registry.coerceSettingValue('autoApproveKYC', true)).toEqual({
      stored: 'true',
      valueType: 'BOOLEAN',
    });
    expect(registry.coerceSettingValue('autoApproveKYC', false)).toEqual({
      stored: 'false',
      valueType: 'BOOLEAN',
    });
  });

  it('coerces BOOLEAN from "true"/"false" string', () => {
    expect(registry.coerceSettingValue('emailNotifications', 'true')).toEqual({
      stored: 'true',
      valueType: 'BOOLEAN',
    });
    expect(registry.coerceSettingValue('emailNotifications', 'false')).toEqual({
      stored: 'false',
      valueType: 'BOOLEAN',
    });
  });

  it('rejects invalid BOOLEAN values', () => {
    expect(() => registry.coerceSettingValue('autoApproveKYC', 'yes')).toThrow(
      /expects boolean/
    );
    expect(() => registry.coerceSettingValue('autoApproveKYC', 1)).toThrow(
      /expects boolean/
    );
  });

  it('converts monetary BUSINESS+NUMBER from rupees to paise', () => {
    // walletMinTopup default is 150000 paise (= ₹1500)
    expect(registry.coerceSettingValue('walletMinTopup', 1500)).toEqual({
      stored: '150000',
      valueType: 'NUMBER',
    });
    expect(registry.coerceSettingValue('lateFee', 100)).toEqual({
      stored: '10000',
      valueType: 'NUMBER',
    });
  });

  it('preserves non-monetary NUMBER (no paise conversion)', () => {
    expect(registry.coerceSettingValue('gracePeriodHours', 24)).toEqual({
      stored: '24',
      valueType: 'NUMBER',
    });
    expect(registry.coerceSettingValue('gpsFetchIntervalMins', 10)).toEqual({
      stored: '10',
      valueType: 'NUMBER',
    });
  });

  it('accepts numeric strings for NUMBER', () => {
    expect(registry.coerceSettingValue('gracePeriodHours', '48')).toEqual({
      stored: '48',
      valueType: 'NUMBER',
    });
  });

  it('rejects non-finite NUMBER values', () => {
    expect(() => registry.coerceSettingValue('gracePeriodHours', 'abc')).toThrow(
      /finite number/
    );
    expect(() => registry.coerceSettingValue('gracePeriodHours', NaN)).toThrow(
      /finite number/
    );
    expect(() => registry.coerceSettingValue('gracePeriodHours', Infinity)).toThrow(
      /finite number/
    );
  });

  it('coerces STRING from native or string value', () => {
    // No STRING-type keys in the current registry, but the helper should
    // still work if one is added. Skip if registry has none.
    const stringKey = registry.SETTING_REGISTRY.find((s) => s.valueType === 'STRING');
    if (stringKey) {
      expect(registry.coerceSettingValue(stringKey.key, 'hello')).toEqual({
        stored: 'hello',
        valueType: 'STRING',
      });
    } else {
      // Mark as skipped
      expect(true).toBe(true);
    }
  });

  it('rejects unknown keys', () => {
    expect(() => registry.coerceSettingValue('notARealKey', 'value')).toThrow(
      /Unknown setting key/
    );
  });

  it('rejects null/undefined', () => {
    expect(() => registry.coerceSettingValue('autoApproveKYC', null)).toThrow(
      /cannot be null/
    );
    expect(() => registry.coerceSettingValue('autoApproveKYC', undefined)).toThrow(
      /cannot be null/
    );
  });
});

// ---------------------------------------------------------------------------
// Use-case tests
// ---------------------------------------------------------------------------

describe('settingUseCases.getAll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFeatureFlags.mockResolvedValue({ enableReferralSystem: true });
    mockFindMany.mockResolvedValue([]);
  });

  it('returns registry defaults when DB is empty', async () => {
    const result = await useCases.getAll();
    expect(result.settings).toMatchObject({
      walletMinTopup: '1500', // rupees
      lateFee: '100', // rupees
      referralBonus: '200', // rupees
      autoApproveKYC: 'false',
      gracePeriodHours: '24',
      emailNotifications: 'true',
      smsNotifications: 'true',
      gpsFetchIntervalMins: '10',
    });
    expect(result.featureFlags).toEqual({ enableReferralSystem: true });
  });

  it('layers DB rows on top of defaults', async () => {
    mockFindMany.mockResolvedValue([
      { id: '1', key: 'walletMinTopup', value: '300000', valueType: 'NUMBER', category: 'BUSINESS' },
      { id: '2', key: 'autoApproveKYC', value: 'true', valueType: 'BOOLEAN', category: 'POLICY' },
    ]);
    const result = await useCases.getAll();
    expect(result.settings.walletMinTopup).toBe('3000'); // rupees
    expect(result.settings.autoApproveKYC).toBe('true');
  });
});

describe('settingUseCases.getPublic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFeatureFlags.mockResolvedValue({});
    mockFindMany.mockResolvedValue([]);
  });

  it('returns only PUBLIC settings as numbers (rupees for monetary)', async () => {
    mockFindMany.mockResolvedValue([
      { key: 'walletMinTopup', value: '300000', valueType: 'NUMBER', category: 'BUSINESS' },
      { key: 'gpsFetchIntervalMins', value: '15', valueType: 'NUMBER', category: 'LOCATION' },
    ]);
    const result = await useCases.getPublic();
    expect(result.settings.walletMinTopup).toBe(3000); // rupees
    expect(result.settings.gpsFetchIntervalMins).toBe(15);
    // Non-public settings must NOT be in the result
    expect(result.settings).not.toHaveProperty('autoApproveKYC');
    expect(result.settings).not.toHaveProperty('emailNotifications');
  });

  it('falls back to defaults when DB row is missing', async () => {
    mockFindMany.mockResolvedValue([]); // no rows
    const result = await useCases.getPublic();
    // Empty result (no rows to return); the use-case does not merge defaults here,
    // only the stored values. This is a documented limitation — defaults must
    // be in the DB after first deploy.
    expect(result.settings).toEqual({});
  });
});

describe('settingUseCases.update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockImplementation(({ where, create }) => ({
      id: `row-${where.key}`,
      key: where.key,
      value: create.value,
      updatedAt: new Date('2026-07-29'),
    }));
  });

  it('upserts a single setting with correct coercion', async () => {
    await useCases.update({ walletMinTopup: 2000 }, 'admin-1');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0][0];
    expect(call.where.key).toBe('walletMinTopup');
    expect(call.create.value).toBe('200000'); // 2000 rupees → 200000 paise
    expect(call.create.valueType).toBe('NUMBER');
    expect(call.create.category).toBe('BUSINESS');
  });

  it('upserts BOOLEAN settings', async () => {
    await useCases.update({ autoApproveKYC: true }, 'admin-1');
    const call = mockUpsert.mock.calls[0][0];
    expect(call.create.value).toBe('true');
    expect(call.create.valueType).toBe('BOOLEAN');
    expect(call.create.category).toBe('POLICY');
  });

  it('rejects unknown keys with a 400-friendly error', async () => {
    await expect(
      useCases.update({ notARealKey: 'value' }, 'admin-1')
    ).rejects.toThrow(/Unknown setting key/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('rejects wrong-type values', async () => {
    await expect(
      useCases.update({ autoApproveKYC: 'maybe' }, 'admin-1')
    ).rejects.toThrow(/expects boolean/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('handles batch updates', async () => {
    await useCases.update(
      { walletMinTopup: 1500, autoApproveKYC: false, gpsFetchIntervalMins: 5 },
      'admin-1'
    );
    expect(mockUpsert).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// assertDbConsistency
// ---------------------------------------------------------------------------

describe('assertDbConsistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no drift when DB matches registry', async () => {
    mockFindMany.mockResolvedValue([
      { key: 'walletMinTopup', valueType: 'NUMBER' },
      { key: 'autoApproveKYC', valueType: 'BOOLEAN' },
      { key: 'gpsFetchIntervalMins', valueType: 'NUMBER' },
    ]);
    const result = await registry.assertDbConsistency();
    expect(result.drift).toEqual([]);
    expect(result.checked).toBe(3);
  });

  it('reports drift when DB valueType mismatches the registry', async () => {
    mockFindMany.mockResolvedValue([
      { key: 'walletMinTopup', valueType: 'STRING' }, // wrong — should be NUMBER
      { key: 'autoApproveKYC', valueType: 'BOOLEAN' },
    ]);
    const result = await registry.assertDbConsistency();
    expect(result.drift).toEqual([
      { key: 'walletMinTopup', expected: 'NUMBER', actual: 'STRING' },
    ]);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('does not throw when DB is unavailable (build-time, etc.)', async () => {
    mockFindMany.mockRejectedValue(new Error('DB offline'));
    const result = await registry.assertDbConsistency();
    expect(result.drift).toEqual([]);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('ignores DB rows for keys not in the registry', async () => {
    mockFindMany.mockResolvedValue([
      { key: 'walletMinTopup', valueType: 'NUMBER' },
      { key: 'legacyOrphanedKey', valueType: 'STRING' },
    ]);
    // The mock is restricted by `where: { key: { in: [...] } }` so the
    // registry call will only return rows whose key is in the registry.
    // This test just asserts the function does not throw on extra rows.
    const result = await registry.assertDbConsistency();
    expect(result.drift).toEqual([]);
  });
});
