/**
 * Rider lifecycle stage ranking — single source of truth.
 *
 * P1-12 (2026-08-05 financial audit): this map was duplicated verbatim across
 * transaction.use-cases, referral.use-cases (×2), onboarding.use-cases,
 * onboarding.repository, wallet.use-cases, and score-calculator. Higher rank
 * = further along onboarding; modules use thresholds like "rank >= 8" for
 * deposit-completed, "rank >= 11" for ACTIVE.
 *
 * DEEP-AUDIT D-P1-2 (2026-08-08): `flatten-rider.ts` previously kept a
 * local variant with a different ordering. That local map is gone —
 * flattenRider uses this canonical map. The threshold numbers in
 * flatten-rider.ts were re-derived from the canonical ranks.
 *
 * AUDIT-FIX 2026-08-13: `flattenRiderPartial` removed (was a debug
 * duplicate of `flattenRider`, only imported by the archived
 * `web/check-flat-8999.js.archived` debug script).
 */
// PR-ONBOARDING-2026-08-11 (audit 5.1): typed keys catch missing /
// mistyped RiderLifecycleStatus members at compile time. A new
// status added to the union but not to the map will fail the build.
import type { RiderLifecycleStatus } from '@/server/modules/riders/rider-lifecycle.service';

export const LIFECYCLE_RANK: Record<RiderLifecycleStatus, number> = {
  NEW: 0,
  PHONE_VERIFIED: 1,
  PROFILE_SUBMITTED: 2,
  KYC_SUBMITTED: 3,
  KYC_APPROVED: 4,
  GUARANTOR_SUBMITTED: 5,
  GUARANTOR_APPROVED: 6,
  DEPOSIT_PENDING: 7,
  DEPOSIT_APPROVED: 8,
  PLAN_SELECTED: 9,
  PICKUP_SCHEDULED: 10,
  ACTIVE: 11,
  SUSPENDED: 12,
  RETURN_PENDING: 13,
  CLOSED: 14,
};

/**
 * Rank of a lifecycle status, defaulting to 0 (NEW) for unknown/empty input.
 *
 * PR-ONBOARDING-2026-08-11 (audit 5.1): the cast `as RiderLifecycleStatus`
 * is intentional — the function signature accepts `string | null` to
 * tolerate unknown statuses (the audit's whole point is "unknown status
 * returns 0"). After the cast, an unknown value will index to `undefined`
 * and fall through to 0.
 */
export function lifecycleRankOf(status: string | null | undefined): number {
  return (LIFECYCLE_RANK as Record<string, number>)[status ?? ''] ?? 0;
}
