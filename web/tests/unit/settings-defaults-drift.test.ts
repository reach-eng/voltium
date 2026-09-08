import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { DEFAULT_SETTINGS } from '@/components/admin/screens/settings/settingsTypes';
import { SETTING_REGISTRY } from '@/server/modules/settings/settings.registry';
import { ADMIN_SETTING_KEYS } from '@/lib/validators/admin';

/**
 * P1-2 (2026-09-07) drift guards.
 *
 * DEFAULT_SETTINGS used to be a hand-maintained literal that disagreed with
 * the registry (referralBonus ₹500 vs ₹200 paise default; placeholder
 * support contacts). DEFAULT_SETTINGS is now DERIVED from the registry, so
 * these tests pin the remaining cross-source contracts:
 *   1. derived defaults == registry display conversion (regression guard:
 *      if someone reverts settingsTypes.ts to a literal, or changes the
 *      conversion, this fails)
 *   2. registry support contact == Flutter AppConfig support contact
 *      (the rider app and admin UI must show riders the same details)
 *   3. registry referralBonus == seed value (DB bootstrap == registry)
 */

function registryKey(key: string): (typeof SETTING_REGISTRY)[number] {
  const meta = SETTING_REGISTRY.find((s) => s.key === key);
  if (!meta) throw new Error(`registry key missing: ${key}`);
  return meta;
}

describe('P1-2 DEFAULT_SETTINGS == registry display conversion', () => {
  it('converts BUSINESS numbers paise → rupees', () => {
    expect(DEFAULT_SETTINGS.walletMinTopup).toBe('1500'); // 150000 paise
    expect(DEFAULT_SETTINGS.lateFee).toBe('100'); // 10000 paise
    expect(DEFAULT_SETTINGS.referralBonus).toBe('500'); // 50000 paise
    expect(DEFAULT_SETTINGS.maxWalletBalance).toBe('10000'); // 1000000 paise
  });

  it('passes STRING/POLICY/LOCATION values through unchanged', () => {
    expect(DEFAULT_SETTINGS.autoApproveKYC).toBe('false');
    expect(DEFAULT_SETTINGS.gracePeriodHours).toBe('24');
    expect(DEFAULT_SETTINGS.gpsFetchIntervalMins).toBe('10');
  });

  it('covers exactly the admin-surface keys with no drift (revert-to-literal guard)', () => {
    // The UI surface = ADMIN_SETTING_KEYS (the PUT allowlist). Registry keys
    // with dedicated writers (e.g. skipGuarantorExtraDeposit) intentionally
    // have their own screens/routes and are NOT part of this surface —
    // liveness of registry↔allowlist is guarded separately in
    // settings-registry.test.ts (P1-1). If settingsTypes.ts is ever reverted
    // to a hand-written literal, this exact-match fails on the first
    // differing key.
    for (const key of ADMIN_SETTING_KEYS) {
      const meta = registryKey(key);
      const expected =
        meta.valueType === 'NUMBER' && meta.category === 'BUSINESS'
          ? String(Number(meta.defaultValue) / 100)
          : meta.defaultValue;
      expect(
        DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS],
        `DEFAULT_SETTINGS.${key}`
      ).toBe(expected);
    }
    expect(Object.keys(DEFAULT_SETTINGS).sort()).toEqual(
      [...ADMIN_SETTING_KEYS].sort()
    );
  });
});

describe('P1-2 support contact: registry == Flutter AppConfig', () => {
  const appConfigPath = path.resolve(
    __dirname,
    '../../../flutter/lib/config/app_config.dart'
  );
  let appConfig: string;
  try {
    appConfig = readFileSync(appConfigPath, 'utf8');
  } catch {
    // Flutter tree not present in this checkout (web-only CI slice).
    appConfig = '';
  }

  it('supportEmail matches AppConfig.supportEmail', () => {
    if (!appConfig) return;
    const m = appConfig.match(/supportEmail = '([^']+)'/);
    expect(m, 'AppConfig.supportEmail literal found').toBeTruthy();
    expect(registryKey('supportEmail').defaultValue).toBe(m![1]);
  });

  it('supportPhone matches AppConfig.supportPhone (display format)', () => {
    if (!appConfig) return;
    const m = appConfig.match(/supportPhone = '([^']+)'/);
    expect(m, 'AppConfig.supportPhone literal found').toBeTruthy();
    expect(registryKey('supportPhone').defaultValue).toBe(m![1]);
  });
});

describe('P1-2 referralBonus: registry == seed', () => {
  it('seed writes the same rupee amount as the registry default', () => {
    const seedPath = path.resolve(__dirname, '../../prisma/seed.ts');
    let seed: string;
    try {
      seed = readFileSync(seedPath, 'utf8');
    } catch {
      return; // seed not present in this checkout
    }
    const m = seed.match(/key: 'referralBonus', value: String\(paise\((\d+)\)\)/);
    expect(m, 'seed referralBonus literal found').toBeTruthy();
    const registryRupees = Number(registryKey('referralBonus').defaultValue) / 100;
    expect(Number(m![1])).toBe(registryRupees);
  });
});
