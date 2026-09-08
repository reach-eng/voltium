/**
 * Admin UI helpers — KYC badge color mapping, state filter constants.
 *
 * Single source of truth for admin-side status visual treatment.
 * Pre-extraction: each screen had its own `getKycBadge` / `STATE_FILTERS`
 * with subtle drift (kyc-management mapped SUBMITTED to blue,
 * rider-management mapped it to amber). Phase 7 Q2 consolidated them
 * to this canonical module.
 */

import type { Rider, KycStatus, RiderLifecycleStage } from './types/admin';

// Re-export so consumers can `import { Rider, KycStatus } from '@/lib/admin-ui'`.
export type { Rider, KycStatus, RiderLifecycleStage };

// ============================================================================
// KYC badge — Tailwind class string
// ============================================================================

const KYC_COLOR_MAP: Record<string, string> = {
  APPROVED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  VERIFIED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  ACTIVE: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  POST_ACTIVE: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  REJECTED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  SUSPENDED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  CLOSED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  PENDING: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  PRE_ACTIVE: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  SUBMITTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
  KYC_SUBMITTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
  INFO_REQUIRED: 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400',
  ONBOARDING: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
};

const FALLBACK_COLOR = 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';

/**
 * Returns a Tailwind class string for a given KYC status.
 *
 * Product decision (Phase 7 Q2, 2026-07-29):
 * - SUBMITTED → blue (informational: rider has submitted, awaiting review)
 * - PENDING → amber (action needed: ops team should follow up)
 * - APPROVED / VERIFIED → emerald (success)
 * - REJECTED / SUSPENDED → rose (problem)
 * - INFO_REQUIRED → orange (rider needs to do something)
 * - unknown → slate (fallback)
 */
export function getKycBadge(status: string | null | undefined): string {
  if (!status) return FALLBACK_COLOR;
  const key = status.toUpperCase();
  return KYC_COLOR_MAP[key] ?? FALLBACK_COLOR;
}

/** Alias for getKycBadge — historically used for rider lifecycle state. */
export const getStateBadge = getKycBadge;

// ============================================================================
// State filters
// ============================================================================

export const STATE_FILTERS: string[] = [
  'ALL',
  'NEW',
  'KYC_SUBMITTED',
  'ONBOARDING',
  'ACTIVE',
  'RETURN_PENDING',
  'CLOSED',
  'SUSPENDED',
];

export type StateFilter = (typeof STATE_FILTERS)[number];

// ============================================================================
// Filter chips
// ============================================================================

export const KYC_FILTERS: string[] = [
  'ALL',
  'PENDING',
  'SUBMITTED',
  'INFO_REQUIRED',
  'APPROVED',
  'REJECTED',
];

export type KycFilter = (typeof KYC_FILTERS)[number];
