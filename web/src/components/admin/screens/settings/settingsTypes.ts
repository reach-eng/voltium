/**
 * R3.7d split — Business settings types & defaults.
 *
 * The Settings shape was inlined inside SettingsManagement.tsx.
 * Extracted so the data hook, save bar, and 5 cards can all share it
 * without circular imports.
 *
 * DEFAULT_SETTINGS is the single source of truth for first-load values
 * and for the merge fallback when the API returns a partial payload.
 */

export interface Settings {
  walletMinTopup: string;
  lateFee: string;
  referralBonus: string;
  autoApproveKYC: string;
  gracePeriodHours: string;
  emailNotifications: string;
  smsNotifications: string;
  maxRentalDays: string;
  penaltyCapDays: string;
  maxWalletBalance: string;
  loyaltyPointsPerRupee: string;
  supportEmail: string;
  supportPhone: string;
  gpsFetchIntervalMins: string;
}

export const DEFAULT_SETTINGS: Settings = {
  walletMinTopup: '1500',
  lateFee: '100',
  referralBonus: '500',
  autoApproveKYC: 'false',
  gracePeriodHours: '24',
  emailNotifications: 'true',
  smsNotifications: 'true',
  maxRentalDays: '30',
  penaltyCapDays: '7',
  maxWalletBalance: '10000',
  loyaltyPointsPerRupee: '1',
  supportEmail: 'support@voltium.in',
  supportPhone: '+91 98765 43210',
  gpsFetchIntervalMins: '10',
};

export type SettingsKey = keyof Settings;
