/**
 * Admin UI — shared visual helpers.
 *
 * Single source of truth for status badges and any other cross-screen
 * admin UI primitives. Adding a new status here automatically applies
 * across the rider management, KYC management, and KYC review screens.
 *
 * Source-of-truth decision (2026-07-29, Phase 7 follow-up):
 *   SUBMITTED → blue (informational, not warning)
 *   PENDING   → amber (needs action)
 *   INFO_REQUIRED → orange (rider needs to do something)
 *   REJECTED  → rose (terminal, negative)
 *   APPROVED / VERIFIED → emerald (positive)
 *
 * The KYC review screen (`KycManagement.tsx` + `KycReviewsTab.tsx`) is the
 * canonical reference; `rider-management/helpers.tsx` previously grouped
 * PENDING and SUBMITTED under amber — that grouping was wrong because
 * SUBMITTED is "we received it" (informational), not "we're waiting on
 * something" (warning). Aligned both screens to blue for SUBMITTED.
 */

/** All status strings accepted by `getKycBadge` and `getStateBadge`. */
export type AdminStatus =
  | 'APPROVED'
  | 'VERIFIED'
  | 'PENDING'
  | 'SUBMITTED'
  | 'REJECTED'
  | 'INFO_REQUIRED'
  | 'SUSPENDED'
  | 'CLOSED'
  | 'ACTIVE'
  | 'NEW'
  | 'ONBOARDING'
  | 'POST_ACTIVE'
  | 'PRE_ACTIVE'
  | 'KYC_SUBMITTED';

const BADGE_STYLES: Record<string, string> = {
  // Positive (emerald)
  APPROVED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  VERIFIED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  ACTIVE: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  POST_ACTIVE: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  // Warning (amber) — needs action but not terminal
  PENDING: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  PRE_ACTIVE: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  // Informational (blue) — received, in flight, no action needed
  SUBMITTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
  KYC_SUBMITTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
  NEW: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
  // Rider needs to do something (orange)
  INFO_REQUIRED: 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400',
  // Terminal negative (rose)
  REJECTED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  SUSPENDED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  CLOSED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  // Neutral (slate)
  ONBOARDING: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
};

const FALLBACK_BADGE =
  'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';

/**
 * Returns Tailwind className for a status badge.
 *
 * Used for KYC, deposit, guarantor, lifecycle, and any other status
 * that fits the {@link AdminStatus} vocabulary.
 *
 * @param status - the status string (case-insensitive)
 * @returns space-separated Tailwind classes for the badge
 */
export function getKycBadge(status: string | null | undefined): string {
  if (!status) return FALLBACK_BADGE;
  return BADGE_STYLES[status.toUpperCase()] ?? FALLBACK_BADGE;
}

/** Alias for lifecycle states — see {@link getKycBadge} for the canonical implementation. */
export function getStateBadge(state: string | null | undefined): string {
  return getKycBadge(state);
}

/** State filter values used by the rider list filter dropdown. */
export const STATE_FILTERS: (AdminStatus | 'ALL')[] = [
  'ALL',
  'NEW',
  'KYC_SUBMITTED',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
];
