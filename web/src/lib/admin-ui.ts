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
  APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  VERIFIED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  POST_ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-300',
  SUSPENDED: 'bg-rose-100 text-rose-800 border-rose-300',
  CLOSED: 'bg-rose-100 text-rose-800 border-rose-300',
  PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
  PRE_ACTIVE: 'bg-amber-100 text-amber-800 border-amber-300',
  SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-300',
  KYC_SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-300',
  INFO_REQUIRED: 'bg-orange-100 text-orange-800 border-orange-300',
  ONBOARDING: 'bg-slate-100 text-slate-600 border-slate-300',
};

const FALLBACK_COLOR = 'bg-slate-100 text-slate-600 border-slate-300';

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
