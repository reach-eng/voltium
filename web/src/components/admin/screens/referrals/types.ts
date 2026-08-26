/**
 * R3.7o split — Referral types.
 *
 * Referral + Summary + RiderOption were inlined in
 * ReferralManagement.tsx. Extracted so the data hook, table,
 * summary cards, and issue dialog can all share the same view
 * of what a referral row looks like.
 */

export interface Referral {
  id: string;
  refereeId: string;
  refereeName: string;
  refereePhone: string;
  refereeState: string;
  referredAt: string;
  referrerName: string;
  referrerCode: string;
  earningForReferrer: number;
  refereePlanStatus?: string;
  refereeLifecycleStatus?: string;
  refereeRentalStatus?: string;
}

export interface Summary {
  totalLeads: number;
  activeRiders: number;
  totalEarnings: number;
}

export interface RiderOption {
  id: string;
  fullName: string;
  riderId: string;
}

export const EMPTY_SUMMARY: Summary = {
  totalLeads: 0,
  activeRiders: 0,
  totalEarnings: 0,
};

export const REFERRAL_PAGE_SIZE = 20;
export const RIDERS_PICKER_LIMIT = 50;
export const DEFAULT_REFERRAL_BONUS = 500;

/** Status filter options for the table. */
export const REFERRAL_STATUS_FILTERS = [
  { value: 'all', label: 'All Referrals' },
  { value: 'NEW', label: 'New' },
  { value: 'KYC_SUBMITTED', label: 'KYC Submitted' },
  { value: 'ACTIVE', label: 'Verified Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
];
