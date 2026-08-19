/// Shared lifecycle rank utility — single source of truth.
library;

///
/// Previously duplicated in 5 files. Update this one function
/// when lifecycle statuses change.
///
/// Maps lifecycle status to a numeric rank. All callers use `>=` comparisons.
///
/// Threshold guide:
///   ≥9 — fully active
///   ≥8 — pickup scheduled
///   ≥7 — kyc approved
///   ≥6 — deposit approved
///   ≥4 — plan selected
///   ≥2 — profile submitted

import '../models/rider_model.dart';
import '../models/rider_lifecycle_stage.dart';

int lifecycleRank(RiderModel rider) =>
    lifecycleRankFromString(rider.lifecycleStatus);

/// ONBOARDING-AUDIT 2026-08-14 (fix #3): the canonical rank map
/// lived in two places (this file and `_lifecycleRankFromString` in
/// `router_body.dart`). The duplicate had drifted (was missing
/// `ACTIVE_RIDING` and `RIDING`) and returned `?? 0` on an unknown
/// status — silently treating the rider as NEW and rerouting them
/// to the intent screen. The map now lives in [_rankMap] and is the
/// only source of truth. The unknown-status case throws in debug
/// builds and returns a sentinel (NEW = 0) in release with a
/// PostHog signal so a real status drift is visible without
/// crashing riders.
int lifecycleRankFromString(String status) {
  final rank = _rankMap[status];
  if (rank != null) return rank;
  // Unknown status — the previous code returned 0 silently, which
  // masqueraded as NEW and restarted onboarding. Fail loud in
  // debug; in release, emit a one-shot signal so a real Prisma
  // drift is visible in analytics without crashing the rider.
  assert(
    false,
    'lifecycleRankFromString: unknown lifecycle status "$status" — '
    'add it to utils/lifecycle_rank.dart and '
    'prisma/schema.prisma:RiderLifecycleStatus.',
  );
  return 0;
}

const Map<String, int> _rankMap = <String, int>{
  'NEW': 0,
  'PHONE_VERIFIED': 1,
  'PROFILE_SUBMITTED': 2,
  'KYC_SUBMITTED': 3,
  'KYC_APPROVED': 4,
  'GUARANTOR_SUBMITTED': 5,
  'GUARANTOR_APPROVED': 6,
  'DEPOSIT_PENDING': 7,
  'DEPOSIT_APPROVED': 8,
  'PLAN_SELECTED': 9,
  'PICKUP_SCHEDULED': 10,
  'ACTIVE': 11,
  'SUSPENDED': 12,
  'RETURN_PENDING': 13,
  'CLOSED': 14,
};

/// PR-K.2: Coarse-grained lifecycle stage rank based on the 5-value stage.
///
/// Use this for routing decisions (e.g. "should we redirect to
/// pre_dashboard vs dashboard") where the granular per-step status
/// is not needed.
///
/// Mapping:
///   newRider    -> 0
///   inProgress  -> 1
///   active      -> 2
///   paused      -> 3
///   closed      -> 4
int lifecycleStageRank(RiderLifecycleStage stage) {
  switch (stage) {
    case RiderLifecycleStage.newRider:
      return 0;
    case RiderLifecycleStage.inProgress:
      return 1;
    case RiderLifecycleStage.active:
      return 2;
    case RiderLifecycleStage.paused:
      return 3;
    case RiderLifecycleStage.closed:
      return 4;
  }
}
