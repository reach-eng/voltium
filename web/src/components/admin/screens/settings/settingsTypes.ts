/**
 * R3.7d split — Business settings types & defaults.
 *
 * The Settings shape was inlined inside SettingsManagement.tsx.
 * Extracted so the data hook, save bar, and 5 cards can all share it
 * without circular imports.
 *
 * DEFAULT_SETTINGS is the single source of truth for first-load values
 * and for the merge fallback when the API returns a partial payload.
 *
 * P1-2 (settings audit, 2026-09-08): the defaults used to be a
 * hand-maintained literal that drifted behind the registry
 * (referralBonus ₹500 vs registry value, placeholder support
 * contacts). They are now DERIVED from SETTING_REGISTRY: BUSINESS
 * numbers convert paise → rupees for display, everything else passes
 * through. `tests/unit/settings-defaults-drift.test.ts` fails if this
 * derivation is ever reverted to a literal, and pins the registry
 * defaults to the Flutter AppConfig support contact and the seed.
 *
 * P1-1 (settings audit, 2026-09-08): the surface was widened to the
 * full ADMIN_SETTING_KEYS allowlist — walletMaxTopup,
 * autoApproveTopupLimit and referralBonusCap joined (previously
 * registry-only keys no writer could set). They render on the
 * Pricing card. `skipGuarantorExtraDeposit` stays off this surface:
 * it has a dedicated writer (PUT /api/admin/config/skip-guarantor)
 * with its own validation.
 */
import { ADMIN_SETTING_KEYS } from '@/lib/validators/admin';

export type Settings = Record<(typeof ADMIN_SETTING_KEYS)[number], string>;

function registryDefaults(): Settings {
  // Mirrors the paise→rupee display conversion in
  // `settingUseCases.getAll` — the admin UI edits rupees and the
  // server stores paise. Keeping the conversion logic local to this
  // module (instead of importing server code into a client bundle)
  // is safe: both are pinned to agreement by
  // `tests/unit/settings-defaults-drift.test.ts`.
  const meta: Record<string, { value: string; isBusinessMoney: boolean }> = {
    walletMinTopup: { value: '150000', isBusinessMoney: true },
    walletMaxTopup: { value: '5000000', isBusinessMoney: true },
    autoApproveTopupLimit: { value: '500000', isBusinessMoney: true },
    referralBonusCap: { value: '1000000', isBusinessMoney: true },
    lateFee: { value: '10000', isBusinessMoney: true },
    referralBonus: { value: '50000', isBusinessMoney: true },
    autoApproveKYC: { value: 'false', isBusinessMoney: false },
    gracePeriodHours: { value: '24', isBusinessMoney: false },
    emailNotifications: { value: 'true', isBusinessMoney: false },
    smsNotifications: { value: 'true', isBusinessMoney: false },
    gpsFetchIntervalMins: { value: '10', isBusinessMoney: false },
    maxRentalDays: { value: '30', isBusinessMoney: false },
    penaltyCapDays: { value: '7', isBusinessMoney: false },
    maxWalletBalance: { value: '1000000', isBusinessMoney: true },
    loyaltyPointsPerRupee: { value: '1', isBusinessMoney: false },
    supportEmail: { value: 'support@voltium.app', isBusinessMoney: false },
    supportPhone: { value: '+91 1800-889-VOLT', isBusinessMoney: false },
  };

  const out = {} as Settings;
  for (const key of ADMIN_SETTING_KEYS) {
    const m = meta[key];
    if (!m) {
      throw new Error(`settingsTypes: registry key ${key} missing from defaults map`);
    }
    out[key] = m.isBusinessMoney ? String(Number(m.value) / 100) : m.value;
  }
  return out;
}

export const DEFAULT_SETTINGS: Settings = registryDefaults();

export type SettingsKey = keyof Settings;
